using System;
using System.Collections.Generic;
using System.IO;
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
    /// Реализация сервиса аналитика для генерации ТТ.
    /// </summary>
    public class AnalystService : IAnalystService
    {
        private readonly IProjectService _projectService;
        private readonly IDocumentService _documentService;
        private readonly IAssistantPromptService _promptService;
        private readonly ILmStudioClient _lmStudioClient;
        private readonly ILmStudioSettingsService _settingsService;
        private readonly IAuditService _auditService;
        private readonly IOutputPostProcessor _postProcessor;
        private readonly ILogger<AnalystService> _logger;
        private readonly ProjectStorageSettings _storageSettings;

        public AnalystService(
            IProjectService projectService,
            IDocumentService documentService,
            IAssistantPromptService promptService,
            ILmStudioClient lmStudioClient,
            ILmStudioSettingsService settingsService,
            IAuditService auditService,
            IOutputPostProcessor postProcessor,
            ILogger<AnalystService> logger,
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
        public async Task<AnalystGenerationResult> GenerateAnalysisAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя генерировать артефакты для закрытого проекта.");

            // 2. Получаем активный принятый ТТ
            var activeDocs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken);
            var ttDoc = activeDocs.Find(d => d.Type == DocumentTypeConstants.TT);
            if (ttDoc == null)
                throw new InvalidOperationException("Для генерации анализа требуется активный принятый документ типа 'ТТ'.");

            // 3. Получаем промт для аналитика (анализ)
            var prompt = await _promptService.GetPromptAsync("Analyst_Analysis");
            if (prompt == null)
                throw new InvalidOperationException("Системный промт для аналитика (анализ) не найден. Обратитесь к администратору.");

            // 4. Определяем модель для аналитика
            var settings = await _settingsService.GetSettingsAsync();
            var model = settings.AnalystModel ?? settings.DefaultModel;

            // 5. Формируем сообщение пользователя
            var userMessage = $"Технические требования (ТТ):\n{ttDoc.Content}";

            // 6. Вызываем LM Studio с инструментом create_file
            var tools = new List<ToolDefinition> { AssistantConstants.CreateFileToolDefinition };
            LmStudioResponse response;
            try
            {
                response = await _lmStudioClient.SendChatCompletionAsync(
                    prompt.SystemPrompt, userMessage, tools, model, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при вызове LM Studio для генерации анализа, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", $"Ошибка вызова LM Studio: {ex.Message}");
                return new AnalystGenerationResult { ErrorDocument = errorDoc };
            }

            // 7. Обработка ответа
            if (!response.HasToolCalls)
            {
                _logger.LogWarning("Модель вернула текст вместо tool calls для анализа, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", response.Content);
                return new AnalystGenerationResult { ErrorDocument = errorDoc };
            }

            // 8. Обрабатываем вызовы (ожидаем три create_file: АТ, РИСК, ПИ)
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

                    // Сохраняем файл
                    var fullPath = await SaveFileToProjectAsync(projectId, path, content, cancellationToken);

                    // Создаём документ как черновик
                    var documentDto = await _documentService.CreateDocumentAsync(
                        projectId, userId, isAdmin, docType, Path.GetFileNameWithoutExtension(path), content, cancellationToken);
                    createdDocuments.Add(documentDto);

                    await _auditService.LogAsync(userId, "AnalystGenerateAnalysis", "Project", projectId,
                        new { DocumentType = docType, Path = fullPath });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка обработки вызова create_file для анализа, проект {ProjectId}", projectId);
                    // Определяем тип ошибки на основе пути из аргументов
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
                        if (detectedType != null)
                            errorType = $"ERR_{detectedType}";
                    }

                    var errorDoc = await CreateErrorDocumentAsync(projectId, userId, errorType, ex.Message);
                    return new AnalystGenerationResult { ErrorDocument = errorDoc };
                }
            }

            // 9. Проверяем, что созданы все три артефакта
            var requiredTypes = new[] { DocumentTypeConstants.AT, DocumentTypeConstants.RISK, DocumentTypeConstants.PI };
            var createdTypes = new HashSet<string>(createdDocuments.Select(d => d.Type));
            var missingTypes = requiredTypes.Where(t => !createdTypes.Contains(t)).ToList();

            if (missingTypes.Count > 0)
            {
                var errorMessage = $"Не все аналитические артефакты были созданы. Отсутствуют: {string.Join(", ", missingTypes)}";
                _logger.LogWarning(errorMessage);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", errorMessage);
                return new AnalystGenerationResult { ErrorDocument = errorDoc };
            }

            // 10. Успех
            await _auditService.LogAsync(userId, "AnalystGenerateAnalysisComplete", "Project", projectId,
                new { CreatedDocuments = createdDocuments.Select(d => d.Type) });
            return new AnalystGenerationResult { CreatedDocuments = createdDocuments };
        }

        /// <summary>
        /// Определяет тип документа по пути файла (для аналитика).
        /// </summary>
        private string DetectDocumentTypeFromPath(string path)
        {
            var fileName = Path.GetFileNameWithoutExtension(path);
            if (fileName.Contains("АТ") || fileName.Contains("анализ_требований"))
                return DocumentTypeConstants.AT;
            if (fileName.Contains("РИСК") || fileName.Contains("риски"))
                return DocumentTypeConstants.RISK;
            if (fileName.Contains("ПИ") || fileName.Contains("пользовательские_истории"))
                return DocumentTypeConstants.PI;
            return null;
        }

        /// <inheritdoc/>
        public async Task<AnalystGenerationResult> GenerateTechnicalRequirementsAsync(
            int projectId,
            int userId,
            bool isAdmin,
            CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя генерировать артефакты для закрытого проекта.");

            // 2. Получаем активный принятый ИД
            var idDoc = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken)
                .ContinueWith(t => t.Result.Find(d => d.Type == DocumentTypeConstants.ID));

            if (idDoc == null)
                throw new InvalidOperationException("Для генерации ТТ требуется активный принятый документ типа 'ИД'.");

            // 3. Получаем промт для аналитика (ТТ)
            var prompt = await _promptService.GetPromptAsync("Analyst_TT");
            if (prompt == null)
                throw new InvalidOperationException("Системный промт для аналитика (ТТ) не найден. Обратитесь к администратору.");

            // 4. Определяем модель для аналитика
            var settings = await _settingsService.GetSettingsAsync();
            var model = settings.AnalystModel ?? settings.DefaultModel;

            // 5. Формируем сообщение пользователя
            var userMessage = $"Исходные данные (ИД):\n{idDoc.Content}";

            // 6. Вызываем LM Studio с инструментом create_file
            var tools = new List<ToolDefinition> { AssistantConstants.CreateFileToolDefinition };
            LmStudioResponse response;
            try
            {
                response = await _lmStudioClient.SendChatCompletionAsync(
                    prompt.SystemPrompt, userMessage, tools, model, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при вызове LM Studio для генерации ТТ, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR_TT", $"Ошибка вызова LM Studio: {ex.Message}");
                return new AnalystGenerationResult { ErrorDocument = errorDoc };
            }

            // 7. Обработка ответа
            if (!response.HasToolCalls)
            {
                _logger.LogWarning("Модель вернула текст вместо tool calls для ТТ, проект {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR_TT", response.Content);
                return new AnalystGenerationResult { ErrorDocument = errorDoc };
            }

            // 8. Обрабатываем вызовы (ожидаем один create_file для ТТ)
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

                    // Постобработка контента
                    content = _postProcessor.PostProcess(content);

                    // Сохраняем файл
                    var fullPath = await SaveFileToProjectAsync(projectId, path, content, cancellationToken);

                    // Создаём документ ТТ как черновик
                    var documentDto = await _documentService.CreateDocumentAsync(
                        projectId, userId, isAdmin, DocumentTypeConstants.TT,
                        Path.GetFileNameWithoutExtension(path), content, cancellationToken);

                    await _auditService.LogAsync(userId, "AnalystGenerateTT", "Project", projectId,
                        new { DocumentType = DocumentTypeConstants.TT, Path = fullPath });

                    return new AnalystGenerationResult { CreatedDocument = documentDto };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка обработки вызова create_file для ТТ, проект {ProjectId}", projectId);
                    var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR_TT", ex.Message);
                    return new AnalystGenerationResult { ErrorDocument = errorDoc };
                }
            }

            // Если не нашли ни одного create_file
            var missingError = await CreateErrorDocumentAsync(projectId, userId, "ERR_TT", "Модель не создала файл для ТТ.");
            return new AnalystGenerationResult { ErrorDocument = missingError };
        }

        /// <summary>
        /// Сохраняет файл в папку DOCS/анализ проекта.
        /// </summary>
        private async Task<string> SaveFileToProjectAsync(int projectId, string relativePath, string content, CancellationToken cancellationToken)
        {
            var rootPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!Directory.Exists(rootPath))
                Directory.CreateDirectory(rootPath);

            if (!PathHelper.TryGetSafeFullPath(rootPath, relativePath, out var fullPath))
                throw new ArgumentException($"Некорректный путь: {relativePath}");

            PathHelper.EnsureDirectoryExists(fullPath);

            // Дополнительная проверка размера и бинарности (можно позже)
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
                projectId,
                userId,
                true,
                errorType,
                "Ошибка генерации",
                errorMessage);
        }
    }
}