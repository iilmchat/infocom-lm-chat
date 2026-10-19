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
        private readonly ILogger<DeveloperTaskService> _logger;

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
            ILogger<DeveloperTaskService> logger)
        {
            _context = context;
            _projectService = projectService;
            _documentService = documentService;
            _promptService = promptService;
            _lmStudioClient = lmStudioClient;
            _settingsService = settingsService;
            _auditService = auditService;
            _logger = logger;
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