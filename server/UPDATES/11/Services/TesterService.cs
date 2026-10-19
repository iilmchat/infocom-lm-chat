using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProjectManager.API.DTOs;
using ProjectManager.API.Helpers;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса тестировщика.
    /// </summary>
    public class TesterService : ITesterService
    {
        private readonly IProjectService _projectService;
        private readonly IDocumentService _documentService;
        private readonly IAssistantPromptService _promptService;
        private readonly ILmStudioClient _lmStudioClient;
        private readonly ILmStudioSettingsService _settingsService;
        private readonly IAuditService _auditService;
        private readonly IOutputPostProcessor _postProcessor;
        private readonly ILogger<TesterService> _logger;
        private readonly ProjectStorageSettings _storageSettings;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="TesterService"/>.
        /// </summary>
        public TesterService(
            IProjectService projectService,
            IDocumentService documentService,
            IAssistantPromptService promptService,
            ILmStudioClient lmStudioClient,
            ILmStudioSettingsService settingsService,
            IAuditService auditService,
            IOutputPostProcessor postProcessor,
            ILogger<TesterService> logger,
            IOptions<ProjectStorageSettings> storageOptions)
        {
            _projectService = projectService;
            _documentService = documentService;
            _promptService = promptService;
            _lmStudioClient = lmStudioClient;
            _settingsService = settingsService;
            _auditService = auditService;
            _postProcessor = postProcessor;
            _logger = logger;
            _storageSettings = storageOptions.Value;
        }

        /// <inheritdoc/>
        public async Task<TesterGenerationResult> GenerateTestArtifactsAsync(
            int projectId,
            int userId,
            bool isAdmin,
            CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя генерировать артефакты для закрытого проекта.");

            // 2. Получаем активные принятые документы
            var activeDocs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken);

            // 3. Проверяем наличие всех обязательных входных документов
            var requiredTypes = new[]
            {
                DocumentTypeConstants.AT,
                DocumentTypeConstants.PI,
                DocumentTypeConstants.CODE,
                DocumentTypeConstants.DEV_DOC
            };
            var missing = requiredTypes.Where(t => !activeDocs.Any(d => d.Type == t)).ToList();
            if (missing.Count > 0)
                throw new InvalidOperationException(
                    $"Для запуска тестировщика требуются принятые документы: {string.Join(", ", missing)}.");

            // 4. Формируем контекст для модели
            var contextBuilder = new System.Text.StringBuilder();
            foreach (var type in requiredTypes)
            {
                var doc = activeDocs.First(d => d.Type == type);
                contextBuilder.AppendLine($"### Документ {type} ({doc.Title})");
                contextBuilder.AppendLine(doc.Content);
                contextBuilder.AppendLine();
            }

            // 5. Получаем промт для тестировщика
            var prompt = await _promptService.GetPromptAsync("Tester");
            if (prompt == null)
                throw new InvalidOperationException("Системный промт для тестировщика не найден. Обратитесь к администратору.");

            // 6. Определяем модель для тестировщика
            var settings = await _settingsService.GetSettingsAsync();
            var model = settings.TesterModel ?? settings.DefaultModel;

            // 7. Вызываем LM Studio с инструментом create_file
            var tools = new List<ToolDefinition> { AssistantConstants.CreateFileToolDefinition };
            LmStudioResponse response;
            try
            {
                response = await _lmStudioClient.SendChatCompletionAsync(
                    prompt.SystemPrompt,
                    contextBuilder.ToString(),
                    tools,
                    model,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка вызова LM Studio для тестировщика, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", $"Ошибка вызова LM Studio: {ex.Message}");
                return new TesterGenerationResult { ErrorDocument = errorDoc };
            }

            // 8. Обработка ответа
            if (!response.HasToolCalls)
            {
                _logger.LogWarning("Модель вернула текст вместо tool calls для тестировщика, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", response.Content);
                return new TesterGenerationResult { ErrorDocument = errorDoc };
            }

            // 9. Обрабатываем вызовы create_file
            var createdDocuments = new List<DocumentDto>();
            foreach (var toolCall in response.ToolCalls)
            {
                if (toolCall.FunctionName != "create_file")
                    continue;

                try
                {
                    using var doc = JsonDocument.Parse(toolCall.Arguments);
                    var path = doc.RootElement.GetProperty("path").GetString();
                    var content = doc.RootElement.GetProperty("content").GetString();

                    if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(content))
                        continue;

                    // Постобработка
                    content = _postProcessor.PostProcess(content);

                    // Определяем тип документа по пути
                    var docType = DetectDocumentTypeFromPath(path);
                    if (docType == null)
                    {
                        _logger.LogWarning("Не удалось определить тип документа для пути {Path}", path);
                        continue;
                    }

                    // Сохраняем файл в папке tests/
                    var fullPath = await SaveFileToProjectAsync(projectId, path, content, cancellationToken);

                    // Создаём документ (черновик)
                    var documentDto = await _documentService.CreateDocumentAsync(
                        projectId, userId, isAdmin, docType, Path.GetFileNameWithoutExtension(path), content, cancellationToken);
                    createdDocuments.Add(documentDto);

                    await _auditService.LogAsync(userId, "TesterGenerateFile", "Project", projectId,
                        new { DocumentType = docType, Path = fullPath });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка обработки вызова create_file для тестировщика, проект {ProjectId}", projectId);

                    // Определяем тип ошибки по пути из аргументов
                    string pathFromArgs = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(toolCall.Arguments);
                        if (doc.RootElement.TryGetProperty("path", out var pathElement))
                            pathFromArgs = pathElement.GetString();
                    }
                    catch { }

                    var errorType = "ERR";
                    if (!string.IsNullOrEmpty(pathFromArgs))
                    {
                        var detectedType = DetectDocumentTypeFromPath(pathFromArgs);
                        if (detectedType == DocumentTypeConstants.TP) errorType = DocumentTypeConstants.ERR_TP;
                        else if (detectedType == DocumentTypeConstants.TK) errorType = DocumentTypeConstants.ERR_TK;
                        else if (detectedType == DocumentTypeConstants.OT) errorType = DocumentTypeConstants.ERR_OT;
                    }

                    var errorDoc = await CreateErrorDocumentAsync(projectId, userId, errorType, ex.Message);
                    return new TesterGenerationResult { ErrorDocument = errorDoc };
                }
            }

            // 10. Проверяем, что созданы все три артефакта
            var requiredArtifacts = new[] { DocumentTypeConstants.TP, DocumentTypeConstants.TK, DocumentTypeConstants.OT };
            var createdTypes = new HashSet<string>(createdDocuments.Select(d => d.Type));
            var missingArtifacts = requiredArtifacts.Where(t => !createdTypes.Contains(t)).ToList();
            if (missingArtifacts.Count > 0)
            {
                var errorMessage = $"Не все тестовые артефакты были созданы. Отсутствуют: {string.Join(", ", missingArtifacts)}";
                _logger.LogWarning(errorMessage);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", errorMessage);
                return new TesterGenerationResult { ErrorDocument = errorDoc };
            }

            // 11. Успех
            await _auditService.LogAsync(userId, "TesterGenerateComplete", "Project", projectId,
                new { CreatedDocuments = createdDocuments.Select(d => d.Type) });
            return new TesterGenerationResult { CreatedDocuments = createdDocuments };
        }

        /// <summary>
        /// Определяет тип документа по пути файла (для тестировщика).
        /// </summary>
        private string DetectDocumentTypeFromPath(string path)
        {
            var fileName = Path.GetFileNameWithoutExtension(path);
            if (fileName.Contains("ТП") || fileName.ToLower().Contains("тест_план") || fileName.ToLower().Contains("test_plan"))
                return DocumentTypeConstants.TP;
            if (fileName.Contains("ТК") || fileName.ToLower().Contains("тест_кейс") || fileName.ToLower().Contains("test_case"))
                return DocumentTypeConstants.TK;
            if (fileName.Contains("ОТ") || fileName.ToLower().Contains("отчёт") || fileName.ToLower().Contains("report"))
                return DocumentTypeConstants.OT;
            return null;
        }

        /// <summary>
        /// Сохраняет файл в папку проекта (для тестировщика — tests/).
        /// </summary>
        private async Task<string> SaveFileToProjectAsync(int projectId, string relativePath, string content, CancellationToken cancellationToken)
        {
            // Максимальный размер файла – 5 МБ
            const int maxFileSizeBytes = 5 * 1024 * 1024;
            var byteCount = System.Text.Encoding.UTF8.GetByteCount(content);
            if (byteCount > maxFileSizeBytes)
                throw new InvalidOperationException($"Превышен максимальный размер файла ({maxFileSizeBytes} байт).");

            var rootPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!Directory.Exists(rootPath))
                Directory.CreateDirectory(rootPath);

            if (!PathHelper.TryGetSafeFullPath(rootPath, relativePath, out var fullPath))
                throw new ArgumentException($"Некорректный путь: {relativePath}");

            PathHelper.EnsureDirectoryExists(fullPath);
            await File.WriteAllTextAsync(fullPath, content, new System.Text.UTF8Encoding(false), cancellationToken);
            return fullPath;
        }

        /// <summary>
        /// Создаёт документ ошибки.
        /// </summary>
        private async Task<DocumentDto> CreateErrorDocumentAsync(int projectId, int userId, string errorType, string errorMessage)
        {
            if (!errorType.StartsWith("ERR_") && errorType != "ERR")
                errorType = $"ERR_{errorType}";

            return await _documentService.CreateDocumentAsync(
                projectId, userId, true, errorType, "Ошибка генерации", errorMessage);
        }
    }
}