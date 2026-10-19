using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Helpers;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;
using Microsoft.Extensions.DependencyInjection; // для IServiceScopeFactory
using ProjectManager.API.Models; // для ProjectStatus, DeveloperTaskStatus

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса задач разработчика.
    /// </summary>
    public class DeveloperTaskService : IDeveloperTaskService
    {
        private readonly AppDbContext _context;
        private readonly IProjectService _projectService;
        private readonly IDocumentService _documentService;
        private readonly IAssistantPromptService _promptService;
        private readonly ILmStudioClient _lmStudioClient;
        private readonly ILmStudioSettingsService _settingsService;
        private readonly IAuditService _auditService;
        private readonly IOutputPostProcessor _postProcessor;        
        private readonly ILogger<DeveloperTaskService> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="DeveloperTaskService"/>.
        /// </summary>
        public DeveloperTaskService(
            AppDbContext context,
            IProjectService projectService,
            IDocumentService documentService,
            IAssistantPromptService promptService,
            ILmStudioClient lmStudioClient,
            ILmStudioSettingsService settingsService,
            IAuditService auditService,
            IOutputPostProcessor postProcessor,
            IServiceScopeFactory serviceScopeFactory,
            ILogger<DeveloperTaskService> logger)
        {        
            _context = context;
            _projectService = projectService;
            _documentService = documentService;
            _promptService = promptService;
            _lmStudioClient = lmStudioClient;
            _settingsService = settingsService;
            _auditService = auditService;
            _postProcessor = postProcessor;            
            _serviceScopeFactory = serviceScopeFactory;       
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task<DeveloperTaskDto> RunTaskAsync(int taskId, int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя выполнять задачи для закрытого проекта.");

            // 2. Получаем задачу
            var task = await _context.DeveloperTasks
                .FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == projectId, cancellationToken);
            if (task == null)
                throw new KeyNotFoundException("Задача не найдена.");

            if (task.Status != DeveloperTaskStatus.Pending && task.Status != DeveloperTaskStatus.Rejected)
                throw new InvalidOperationException($"Нельзя выполнить задачу в статусе {task.Status}. Допустимы Pending или Rejected.");

            // 3. Помечаем задачу как выполняемую
            task.Status = DeveloperTaskStatus.InProgress;
            task.ErrorMessage = null;
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            try
            {
                // 4. Собираем контекст: описание задачи, комментарий, архитектурные артефакты
                var contextBuilder = new System.Text.StringBuilder();
                contextBuilder.AppendLine($"## Задача: {task.Title}");
                contextBuilder.AppendLine($"Описание: {task.Description}");
                if (!string.IsNullOrWhiteSpace(task.Comment))
                    contextBuilder.AppendLine($"Комментарий владельца: {task.Comment}");
                contextBuilder.AppendLine();

                // Добавляем архитектурные артефакты
                var activeDocs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken);
                var architectTypes = new[] { DocumentTypeConstants.IT, DocumentTypeConstants.SP, DocumentTypeConstants.SFS, DocumentTypeConstants.ER };
                foreach (var type in architectTypes)
                {
                    var doc = activeDocs.FirstOrDefault(d => d.Type == type);
                    if (doc != null)
                    {
                        contextBuilder.AppendLine($"### Документ {type} ({doc.Title})");
                        contextBuilder.AppendLine(doc.Content);
                        contextBuilder.AppendLine();
                    }
                }

                // 5. Получаем промт для выполнения задачи
                var prompt = await _promptService.GetPromptAsync("Developer_Task");
                if (prompt == null)
                    throw new InvalidOperationException("Системный промт для выполнения задачи разработчика не найден.");

                // 6. Определяем модель разработчика
                var settings = await _settingsService.GetSettingsAsync();
                var model = settings.DeveloperModel ?? settings.DefaultModel;

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
                    _logger.LogError(ex, "Ошибка вызова LM Studio при выполнении задачи {TaskId}", taskId);
                    task.Status = DeveloperTaskStatus.Rejected;
                    task.ErrorMessage = $"Ошибка вызова LM Studio: {ex.Message}";
                    task.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                    await CreateErrorDocumentAsync(projectId, userId, "ERR_КОД", task.ErrorMessage);
                    return MapToDto(task);
                }

                // 8. Обрабатываем ответ
                if (!response.HasToolCalls)
                {
                    _logger.LogWarning("Модель вернула текст вместо tool calls для задачи {TaskId}", taskId);
                    task.Status = DeveloperTaskStatus.Rejected;
                    task.ErrorMessage = "Модель вернула текст вместо вызова инструментов.";
                    task.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                    await CreateErrorDocumentAsync(projectId, userId, "ERR_КОД", task.ErrorMessage);
                    return MapToDto(task);
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

                        // Сохраняем файл в папке проекта
                        var fullPath = await SaveFileToProjectAsync(projectId, path, content, cancellationToken);

                        // Создаём документ (черновик)
                        var documentDto = await _documentService.CreateDocumentAsync(
                            projectId, userId, isAdmin, docType, Path.GetFileNameWithoutExtension(path), content, cancellationToken);
                        createdDocuments.Add(documentDto);

                        await _auditService.LogAsync(userId, "DeveloperTaskFile", "DeveloperTask", taskId,
                            new { DocumentType = docType, Path = fullPath });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ошибка обработки вызова create_file для задачи {TaskId}", taskId);
                        task.Status = DeveloperTaskStatus.Rejected;
                        task.ErrorMessage = ex.Message;
                        task.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync(cancellationToken);

                        // Пытаемся определить тип ошибки
                        var errorType = "ERR_КОД";
                        try
                        {
                            using var doc = JsonDocument.Parse(toolCall.Arguments);
                            var path = doc.RootElement.GetProperty("path").GetString();
                            var detected = DetectDocumentTypeFromPath(path);
                            if (detected == DocumentTypeConstants.CONFIG) errorType = DocumentTypeConstants.ERR_CONFIG;
                            else if (detected == DocumentTypeConstants.DEV_DOC) errorType = DocumentTypeConstants.ERR_DEV_DOC;
                        }
                        catch { }

                        await CreateErrorDocumentAsync(projectId, userId, errorType, ex.Message);
                        return MapToDto(task);
                    }
                }

                if (createdDocuments.Count == 0)
                {
                    task.Status = DeveloperTaskStatus.Rejected;
                    task.ErrorMessage = "Модель не создала ни одного файла.";
                    task.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                    await CreateErrorDocumentAsync(projectId, userId, "ERR_КОД", task.ErrorMessage);
                    return MapToDto(task);
                }

                // 10. Успех
                task.Status = DeveloperTaskStatus.Completed;
                task.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);

                await _auditService.LogAsync(userId, "RunDeveloperTask", "DeveloperTask", taskId,
                    new { CreatedDocuments = createdDocuments.Select(d => d.Type) });

                return MapToDto(task);
            }
            catch (Exception ex)
            {
                // Общая ошибка – помечаем задачу как отклонённую
                task.Status = DeveloperTaskStatus.Rejected;
                task.ErrorMessage = ex.Message;
                task.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                throw;
            }
        }

        /// <inheritdoc/>
        public async Task<DeveloperTaskDto> ApproveTaskAsync(int taskId, int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять задачи закрытого проекта.");

            var task = await _context.DeveloperTasks
                .FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == projectId, cancellationToken);
            if (task == null)
                throw new KeyNotFoundException("Задача не найдена.");

            if (task.Status != DeveloperTaskStatus.Completed)
                throw new InvalidOperationException("Подтвердить можно только задачу в статусе Completed.");

            task.Status = DeveloperTaskStatus.Approved;
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(userId, "ApproveDeveloperTask", "DeveloperTask", taskId, new { projectId });

            // Автоматически запускаем следующую задачу (по порядку), если она есть и в статусе Pending
            var nextTask = await _context.DeveloperTasks
                .Where(t => t.ProjectId == projectId && t.Order > task.Order && t.Status == DeveloperTaskStatus.Pending)
                .OrderBy(t => t.Order)
                .FirstOrDefaultAsync(cancellationToken);

            if (nextTask != null)
            {
                _ = Task.Run(async () =>
                {
                    using var scope = _serviceScopeFactory.CreateScope();
                    var service = scope.ServiceProvider.GetRequiredService<IDeveloperTaskService>();
                    var logger = scope.ServiceProvider.GetRequiredService<ILogger<DeveloperTaskService>>();
                    try
                    {
                        await service.RunTaskAsync(nextTask.Id, projectId, userId, true);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Ошибка автоматического запуска следующей задачи {TaskId}", nextTask.Id);
                    }
                });
            }

            return MapToDto(task);
        }

        /// <inheritdoc/>
        public async Task<DeveloperTaskDto> RejectTaskAsync(int taskId, int projectId, int userId, bool isAdmin, string comment, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(comment))
                throw new ArgumentException("Комментарий обязателен при отклонении задачи.");

            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять задачи закрытого проекта.");

            var task = await _context.DeveloperTasks
                .FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == projectId, cancellationToken);
            if (task == null)
                throw new KeyNotFoundException("Задача не найдена.");

            if (task.Status != DeveloperTaskStatus.Completed)
                throw new InvalidOperationException("Отклонить можно только задачу в статусе Completed.");

            task.Status = DeveloperTaskStatus.Rejected;
            task.Comment = comment; // сохраняем комментарий с замечаниями
            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(userId, "RejectDeveloperTask", "DeveloperTask", taskId,
                new { projectId, comment });

            return MapToDto(task);
        }

        /// <summary>
        /// Определяет тип документа по пути файла (для разработчика).
        /// </summary>
        /// <param name="path">Относительный путь файла.</param>
        /// <returns>Тип документа или null, если определить не удалось.</returns>
        private string DetectDocumentTypeFromPath(string path)
        {
            var lower = path.ToLowerInvariant();
            if (lower.Contains("src/") || lower.EndsWith(".cs") || lower.EndsWith(".java") || lower.EndsWith(".py") || lower.EndsWith(".js") || lower.EndsWith(".ts"))
                return DocumentTypeConstants.CODE;
            if (lower.Contains("config/") || lower.Contains("appsettings") || lower.EndsWith(".json") || lower.EndsWith(".yaml") || lower.EndsWith(".yml") || lower.EndsWith(".xml"))
                return DocumentTypeConstants.CONFIG;
            if (lower.Contains("docs/") || lower.EndsWith(".md") || lower.Contains("readme"))
                return DocumentTypeConstants.DEV_DOC;
            return null;
        }

        /// <summary>
        /// Сохраняет файл в папку проекта с проверкой безопасности.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="relativePath">Относительный путь.</param>
        /// <param name="content">Содержимое файла.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Полный путь к сохранённому файлу.</returns>
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

        /// <inheritdoc/>
        public async Task<List<DeveloperTaskDto>> GeneratePlanAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            // 1. Проверяем права и статус проекта
            var project = await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя генерировать план для закрытого проекта.");

            // 2. Проверяем наличие всех принятых архитектурных артефактов
            var activeDocs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken);
            var requiredTypes = new[] { DocumentTypeConstants.IT, DocumentTypeConstants.SP, DocumentTypeConstants.SFS, DocumentTypeConstants.ER };
            var missing = requiredTypes.Where(t => !activeDocs.Any(d => d.Type == t)).ToList();
            if (missing.Count > 0)
                throw new InvalidOperationException($"Для декомпозиции требуются принятые артефакты: {string.Join(", ", missing)}.");

            // 3. Удаляем старый план, если он есть (перегенерация)
            var existingTasks = await _context.DeveloperTasks
                .Where(t => t.ProjectId == projectId)
                .ToListAsync(cancellationToken);
            if (existingTasks.Any())
            {
                _context.DeveloperTasks.RemoveRange(existingTasks);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 4. Формируем контекст для модели: архитектурные артефакты
            var contextBuilder = new System.Text.StringBuilder();
            foreach (var type in requiredTypes)
            {
                var doc = activeDocs.First(d => d.Type == type);
                contextBuilder.AppendLine($"### Документ {type} ({doc.Title})");
                contextBuilder.AppendLine(doc.Content);
                contextBuilder.AppendLine();
            }

            // 5. Получаем промт для декомпозиции
            var prompt = await _promptService.GetPromptAsync("Developer_Plan");
            if (prompt == null)
                throw new InvalidOperationException("Системный промт для декомпозиции разработчика не найден.");

            // 6. Определяем модель разработчика
            var settings = await _settingsService.GetSettingsAsync();
            var model = settings.DeveloperModel ?? settings.DefaultModel;

            // 7. Вызываем LM Studio (без tool calling — ожидаем JSON со списком задач)
            LmStudioResponse response;
            try
            {
                response = await _lmStudioClient.SendChatCompletionAsync(
                    prompt.SystemPrompt,
                    contextBuilder.ToString(),
                    new List<ToolDefinition>(),
                    model,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка вызова LM Studio при декомпозиции, проект {ProjectId}", projectId);
                await CreateErrorDocumentAsync(projectId, userId, DocumentTypeConstants.ERR_DECOMP, $"Ошибка вызова LM Studio: {ex.Message}");
                throw new InvalidOperationException("Не удалось получить план задач от LM Studio.");
            }

            // 8. Парсим JSON-ответ модели
            List<PlanTaskItem> planItems;
            try
            {
                planItems = ParsePlanResponse(response.Content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка парсинга плана задач, проект {ProjectId}", projectId);
                await CreateErrorDocumentAsync(projectId, userId, DocumentTypeConstants.ERR_DECOMP, $"Ошибка парсинга плана: {ex.Message}");
                throw new InvalidOperationException("Не удалось распарсить план задач от модели.");
            }

            if (planItems == null || planItems.Count == 0)
            {
                await CreateErrorDocumentAsync(projectId, userId, DocumentTypeConstants.ERR_DECOMP, "Модель вернула пустой план задач.");
                throw new InvalidOperationException("План задач пуст.");
            }

            // 9. Сохраняем задачи в БД
            var order = 1;
            var createdTasks = new List<DeveloperTask>();
            foreach (var item in planItems)
            {
                var task = new DeveloperTask
                {
                    ProjectId = projectId,
                    Title = item.Title ?? $"Задача {order}",
                    Description = item.Description ?? string.Empty,
                    Status = DeveloperTaskStatus.Pending,
                    Order = order++,
                    Comment = null,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.DeveloperTasks.Add(task);
                createdTasks.Add(task);
            }
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(userId, "GenerateDeveloperPlan", "Project", projectId,
                new { TaskCount = createdTasks.Count });

            return createdTasks.Select(MapToDto).ToList();
        }

        /// <inheritdoc/>
        public async Task<List<DeveloperTaskDto>> GetTasksAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);
            var tasks = await _context.DeveloperTasks
                .Where(t => t.ProjectId == projectId)
                .OrderBy(t => t.Order)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
            return tasks.Select(MapToDto).ToList();
        }

        /// <inheritdoc/>
        public async Task<DeveloperTaskDto> UpdateTaskAsync(int taskId, int projectId, int userId, bool isAdmin, UpdateDeveloperTaskRequest request, CancellationToken cancellationToken = default)
        {
            await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);

            var task = await _context.DeveloperTasks
                .FirstOrDefaultAsync(t => t.Id == taskId && t.ProjectId == projectId, cancellationToken);
            if (task == null)
                throw new KeyNotFoundException("Задача не найдена.");

            if (task.Status == DeveloperTaskStatus.Approved)
                throw new InvalidOperationException("Нельзя редактировать подтверждённую задачу.");

            if (!string.IsNullOrWhiteSpace(request.Title))
                task.Title = request.Title;
            if (!string.IsNullOrWhiteSpace(request.Description))
                task.Description = request.Description;
            if (request.Order.HasValue && request.Order.Value > 0)
                task.Order = request.Order.Value;
            if (request.Comment != null)
                task.Comment = request.Comment;

            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(userId, "UpdateDeveloperTask", "DeveloperTask", taskId,
                new { projectId });

            return MapToDto(task);
        }

        /// <inheritdoc/>
        public async Task<List<DeveloperTaskDto>> ApprovePlanAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await _projectService.GetProjectByIdAsync(projectId, userId, isAdmin, cancellationToken);

            var tasks = await _context.DeveloperTasks
                .Where(t => t.ProjectId == projectId)
                .OrderBy(t => t.Order)
                .ToListAsync(cancellationToken);

            if (!tasks.Any())
                throw new InvalidOperationException("План задач пуст. Сначала выполните декомпозицию.");

            foreach (var task in tasks)
            {
                if (task.Status == DeveloperTaskStatus.Rejected)
                    task.Status = DeveloperTaskStatus.Pending; // сброс отклонения при повторном утверждении
            }

            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(userId, "ApproveDeveloperPlan", "Project", projectId,
                new { TaskCount = tasks.Count });

            return tasks.Select(MapToDto).ToList();
        }

        /// <summary>
        /// Парсит ответ модели в список задач.
        /// Ожидается JSON-массив объектов с полями title и description.
        /// </summary>
        /// <param name="content">Текстовый ответ модели.</param>
        /// <returns>Список задач.</returns>
        private List<PlanTaskItem> ParsePlanResponse(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return new List<PlanTaskItem>();

            // Убираем возможные обёртки ```json ... ```
            var trimmed = content.Trim();
            if (trimmed.StartsWith("```"))
            {
                var firstNewLine = trimmed.IndexOf('\n');
                if (firstNewLine >= 0)
                    trimmed = trimmed.Substring(firstNewLine + 1);
                var lastBackticks = trimmed.LastIndexOf("```");
                if (lastBackticks >= 0)
                    trimmed = trimmed.Substring(0, lastBackticks);
                trimmed = trimmed.Trim();
            }

            // Пытаемся найти JSON-массив в тексте
            var start = trimmed.IndexOf('[');
            var end = trimmed.LastIndexOf(']');
            if (start < 0 || end < 0 || end <= start)
                throw new InvalidOperationException("Не найден JSON-массив в ответе модели.");

            var jsonArray = trimmed.Substring(start, end - start + 1);
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var items = JsonSerializer.Deserialize<List<PlanTaskItem>>(jsonArray, options);
            return items ?? new List<PlanTaskItem>();
        }

        /// <summary>
        /// Создаёт документ ошибки декомпозиции.
        /// </summary>
        private async Task CreateErrorDocumentAsync(int projectId, int userId, string errorType, string errorMessage)
        {
            try
            {
                await _documentService.CreateDocumentAsync(
                    projectId, userId, true, errorType, "Ошибка декомпозиции", errorMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Не удалось создать документ ошибки {ErrorType}", errorType);
            }
        }

        /// <summary>
        /// Преобразует сущность <see cref="DeveloperTask"/> в DTO.
        /// </summary>
        private DeveloperTaskDto MapToDto(DeveloperTask task)
        {
            return new DeveloperTaskDto
            {
                Id = task.Id,
                ProjectId = task.ProjectId,
                Title = task.Title,
                Description = task.Description,
                Status = task.Status,
                Order = task.Order,
                Comment = task.Comment,
                ErrorMessage = task.ErrorMessage,
                ParametersJson = task.ParametersJson,
                CreatedAt = task.CreatedAt,
                UpdatedAt = task.UpdatedAt
            };
        }

        /// <summary>
        /// Вспомогательный класс для парсинга элементов плана.
        /// </summary>
        private class PlanTaskItem
        {
            /// <summary>Название задачи.</summary>
            public string Title { get; set; }

            /// <summary>Описание задачи.</summary>
            public string Description { get; set; }
        }
    }
}