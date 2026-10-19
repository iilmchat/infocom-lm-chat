using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
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
    /// Реализация сервиса архитектора для генерации проектных артефактов через LM Studio.
    /// </summary>
    public class ArchitectService : IArchitectService
    {
        private readonly IProjectService _projectService;
        private readonly IDocumentService _documentService;
        private readonly IAssistantPromptService _promptService;
        private readonly ILmStudioClient _lmStudioClient;
        private readonly IAuditService _auditService;
        private readonly ILogger<ArchitectService> _logger;
        private readonly ProjectStorageSettings _storageSettings;

        // В конструктор добавить параметр IOutputPostProcessor postProcessor
        private readonly IOutputPostProcessor _postProcessor;        

        //Добавим в конструктор параметр ILmStudioSettingsService settingsService, сохраним в поле _settingsService
        private readonly ILmStudioSettingsService _settingsService;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="ArchitectService"/>.
        /// </summary>
        /// <param name="projectService">Сервис проектов.</param>
        /// <param name="documentService">Сервис документов.</param>
        /// <param name="promptService">Сервис промтов.</param>
        /// <param name="lmStudioClient">Клиент LM Studio.</param>
        /// <param name="auditService">Сервис аудита.</param>
        /// <param name="logger">Логгер.</param>
        /// <param name="storageOptions">Настройки хранения проектов.</param>
        public ArchitectService(
            IProjectService projectService,
            IDocumentService documentService,
            IAssistantPromptService promptService,
            ILmStudioClient lmStudioClient,
            IAuditService auditService,
            ILogger<ArchitectService> logger,
            IOptions<ProjectStorageSettings> storageOptions,
            IOutputPostProcessor postProcessor,
            ILmStudioSettingsService settingsService)
        {
            _projectService = projectService;
            _documentService = documentService;
            _promptService = promptService;
            _lmStudioClient = lmStudioClient;
            _auditService = auditService;
            _logger = logger;
            _storageSettings = storageOptions.Value;
            _postProcessor = postProcessor;
            _settingsService = settingsService;
        }

        /// <summary>
        /// Генерирует четыре артефакта (ИТ, СП, СФС, ЭР) на основе документов ИД и ТТ.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <returns>Результат генерации с созданными документами или ошибкой.</returns>
        public async Task<ArchitectGenerationResult> GenerateAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя генерировать артефакты для закрытого проекта.");

            // 2. Получаем активные принятые документы ИД и ТТ
            var docs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken;
            var idDoc = docs.Find(d => d.Type == DocumentTypeConstants.ID);
            var ttDoc = docs.Find(d => d.Type == DocumentTypeConstants.TT);

            if (idDoc == null)
                throw new InvalidOperationException("Для генерации требуется активный принятый документ типа 'ИД'.");
            if (ttDoc == null)
                throw new InvalidOperationException("Для генерации требуется активный принятый документ типа 'ТТ'.");

            // 3. Формируем сообщение пользователя (контекст)
            var userMessage = $"Исходные данные (ИД):\n{idDoc.Content}\n\nТехническое задание (ТТ):\n{ttDoc.Content}";

            // 4. Получаем системный промт для архитектора
            var prompt = await _promptService.GetPromptAsync("Architect");
            if (prompt == null)
                throw new InvalidOperationException("Системный промт для архитектора не найден. Обратитесь к администратору.");

            // 5. Вызываем LM Studio с tool calling
            var tools = new List<ToolDefinition> { AssistantConstants.CreateFileToolDefinition };
            LmStudioResponse response;
            try
            {
                var settings = await _settingsService.GetSettingsAsync();
                var model = settings.ArchitectModel ?? settings.DefaultModel;
                //response = await _lmStudioClient.SendChatCompletionAsync(prompt.SystemPrompt, userMessage, tools, model);
                response = await _lmStudioClient.SendChatCompletionAsync(
                                                    prompt.SystemPrompt, 
                                                    userMessage, 
                                                    tools, 
                                                    model,                            // ← вот здесь передаём выбранную модель
                                                    cancellationToken);
                                                    }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при вызове LM Studio для проекта {ProjectId}", projectId);
                // Создаём общий документ ошибки
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", $"Ошибка вызова LM Studio: {ex.Message}");
                return new ArchitectGenerationResult { ErrorDocument = errorDoc };
            }

            // 6. Обрабатываем ответ
            if (!response.HasToolCalls)
            {
                // Модель вернула текст вместо вызовов инструментов
                _logger.LogWarning("Модель вернула текст вместо вызова инструментов для проекта {ProjectId}", projectId);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", response.Content);
                return new ArchitectGenerationResult { ErrorDocument = errorDoc };
            }

            // 7. Обрабатываем вызовы инструментов (создаём файлы и документы)
            var createdDocuments = new List<DocumentDto>();
            foreach (var toolCall in response.ToolCalls)
            {
                if (toolCall.FunctionName != "create_file")
                    continue;

                    try
                    {
                        // Парсим аргументы
                        using var doc = JsonDocument.Parse(toolCall.Arguments);
                        var path = doc.RootElement.GetProperty("path").GetString();
                        var content = doc.RootElement.GetProperty("content").GetString();

                        if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(content))
                        {
                            _logger.LogWarning("Пропущен вызов create_file с пустыми аргументами");
                            continue;
                        }

                    // Определяем тип документа по пути
                        var docType = DetectDocumentTypeFromPath(path);
                        if (docType == null)
                        {
                            _logger.LogWarning("Не удалось определить тип документа для пути {Path}", path);
                            continue;
                        }

                    // Создаём файл в папке DOCS проекта
                        var filePath = await SaveFileToProjectAsync(projectId, path, content);

                        // Создаём документ в БД (черновик)
                        var documentDto = await _documentService.CreateDocumentAsync(
                        projectId, userId, isAdmin, docType, Path.GetFileNameWithoutExtension(path), content);
                        createdDocuments.Add(documentDto);

                        // Логируем создание файла
                    await _auditService.LogAsync(userId, "ArchitectGenerateFile", "Project", projectId, new { DocumentType = docType, Path = filePath });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка обработки вызова create_file для проекта {ProjectId}", projectId);

                    // Определяем тип документа по пути (извлекаем путь из аргументов ещё раз)
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
                    return new ArchitectGenerationResult { ErrorDocument = errorDoc };
                }
            }

            // 8. Проверяем, что созданы все четыре артефакта
            var createdTypes = new HashSet<string>(createdDocuments.Select(d => d.Type));
            var missingTypes = new List<string>();
            foreach (var requiredType in AssistantConstants.ArchitectDocumentTypes)
            {
                if (!createdTypes.Contains(requiredType))
                    missingTypes.Add(requiredType);
            }

            if (missingTypes.Count > 0)
            {
                var errorMessage = $"Не все артефакты были созданы. Отсутствуют: {string.Join(", ", missingTypes)}";
                _logger.LogWarning(errorMessage);
                var errorDoc = await CreateErrorDocumentAsync(projectId, userId, "ERR", errorMessage);
                return new ArchitectGenerationResult { ErrorDocument = errorDoc };
            }

            // 9. Успех
            await _auditService.LogAsync(userId, "ArchitectGenerate", "Project", projectId, new { CreatedDocuments = createdDocuments.Select(d => d.Type) });
            return new ArchitectGenerationResult { CreatedDocuments = createdDocuments };
        }

        /// <summary>
        /// Определяет тип документа по пути файла.
        /// </summary>
        /// <param name="path">Относительный путь к файлу.</param>
        /// <returns>Тип документа или null, если определить не удалось.</returns>
        private string DetectDocumentTypeFromPath(string path)
        {
            var fileName = Path.GetFileNameWithoutExtension(path);
            foreach (var kvp in AssistantConstants.DocumentTypeToFileName)
            {
                if (fileName.Contains(kvp.Value))
                    return kvp.Key;
            }
            return null;
        }

        /// <summary>
        /// Сохраняет файл в папку DOCS проекта, предварительно проверяя содержимое.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="relativePath">Относительный путь файла внутри проекта.</param>
        /// <param name="content">Содержимое файла.</param>
        /// <returns>Полный путь к сохранённому файлу.</returns>
        /// <exception cref="ArgumentException">Если путь некорректен или содержимое недопустимо.</exception>
        /// <exception cref="InvalidOperationException">Если размер файла превышает лимит или обнаружены бинарные данные.</exception>
        private async Task<string> SaveFileToProjectAsync(int projectId, string relativePath, string content)
        {
            // Максимальный размер файла – 1 МБ
            const int maxFileSizeBytes = 1024 * 1024;

            if (string.IsNullOrEmpty(content))
                throw new ArgumentException("Содержимое файла не может быть пустым.");

            // Проверка размера (в байтах, без учёта BOM)
            var byteCount = System.Text.Encoding.UTF8.GetByteCount(content);
            if (byteCount > maxFileSizeBytes)
                throw new InvalidOperationException($"Превышен максимальный размер файла ({maxFileSizeBytes} байт).");

            // Проверка на бинарные данные (наличие нулевых байтов или управляющих символов, кроме разрешённых \r, \n, \t)
            foreach (char c in content)
            {
                if (c == '\0' || (char.IsControl(c) && c != '\r' && c != '\n' && c != '\t'))
                    throw new InvalidOperationException("Обнаружены бинарные данные в содержимом файла.");
            }

            var rootPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!Directory.Exists(rootPath))
                Directory.CreateDirectory(rootPath);

            // Защита от path traversal
            if (!PathHelper.TryGetSafeFullPath(rootPath, relativePath, out var fullPath))
                throw new ArgumentException($"Некорректный путь: {relativePath}");

            // Создаём папки, если их нет
            PathHelper.EnsureDirectoryExists(fullPath);

            // В SaveFileToProjectAsync перед записью:
            content = _postProcessor.PostProcess(content);

            // Записываем файл (UTF-8 без BOM)
            await File.WriteAllTextAsync(fullPath, content, new System.Text.UTF8Encoding(false));
            return fullPath;
        }

        /// <summary>
        /// Создаёт документ с ошибкой в БД.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор пользователя.</param>
        /// <param name="errorType">Тип документа ошибки (ERR или ERR_*).</param>
        /// <param name="errorMessage">Сообщение об ошибке.</param>
        /// <returns>DTO созданного документа.</returns>
        private async Task<DocumentDto> CreateErrorDocumentAsync(int projectId, int userId, string errorType, string errorMessage)
        {
            // Если тип не начинается с ERR_, добавляем префикс (кроме чистого "ERR")
            if (!errorType.StartsWith("ERR_") && errorType != "ERR")
                errorType = $"ERR_{errorType}";

            // Создаём документ с типом ошибки
            var dto = await _documentService.CreateDocumentAsync(
                projectId,
                userId,
                true, // isAdmin=true, т.к. мы уже проверили права на уровне метода
                errorType,
                "Ошибка генерации",
                errorMessage);

            return dto;
        }
    }
}