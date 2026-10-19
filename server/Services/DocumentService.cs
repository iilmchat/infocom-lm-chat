using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Helpers;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса управления документами проекта.
    /// </summary>
    public class DocumentService : IDocumentService
    {
        private readonly AppDbContext _context;
        private readonly IProjectService _projectService;
        // Добавлено в версии 1.2
        private readonly IAuditService _auditService;

        private readonly IIaAssistantService _iaAssistantService; // новая зависимость
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<DocumentService> _logger;

        /*
        // Словарь для проверки последовательности типов
        private static readonly Dictionary<string, string> RequiredPreviousType = new Dictionary<string, string>
        {
            { "Проект", "ИД" },
            { "ТТ", "Проект" },
            { "ПиМ ПСИ", "ТТ" }
            // "ЦБИ" не требует предыдущего
        };
        */

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="DocumentService"/>.
        /// </summary>
        /// <param name="context">Контекст базы данных.</param>
        /// <param name="projectService">Сервис проектов.</param>
        /// <param name="auditService">Сервис аудита.</param>
        /// <param name="iaAssistantService">Сервис ИИ-ассистента для запуска скриптов.</param>
        /// <param name="serviceScopeFactory">Фабрика областей служб для запуска фоновых задач.</param>
        /// <param name="logger">Логгер.</param>
        public DocumentService(
            AppDbContext context,
            IProjectService projectService,
            IAuditService auditService,
            IIaAssistantService iaAssistantService,
            IServiceScopeFactory serviceScopeFactory,
            ILogger<DocumentService> logger)
        {
            _context = context;
            _projectService = projectService;
            _auditService = auditService;
            _iaAssistantService = iaAssistantService;
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        // Словарь для проверки последовательности типов
        private static readonly Dictionary<string, string> RequiredPreviousType = new Dictionary<string, string>
        {
            { DocumentTypeConstants.Project, DocumentTypeConstants.ID },
            { DocumentTypeConstants.TT, DocumentTypeConstants.Project },
            { DocumentTypeConstants.PiM_PSI, DocumentTypeConstants.TT }
            // "ЦБИ" не требует предыдущего
        };

        /// <summary>
        /// Проверяет доступ пользователя к проекту.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="currentUserId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        private async Task EnsureProjectAccessAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            var project = await _context.Projects.FindAsync(new object[] { projectId }, cancellationToken);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, currentUserId, cancellationToken))
                throw new UnauthorizedAccessException("У вас нет доступа к этому проекту.");
        }

        /// <summary>
        /// Проверяет, что проект не закрыт для изменяющих операций.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        private async Task EnsureProjectNotClosedAsync(int projectId, CancellationToken cancellationToken = default)
        {
            var project = await _context.Projects.FindAsync(new object[] { projectId }, cancellationToken);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять документы закрытого проекта.");
        }

        /// <summary>
        /// Проверяет последовательность типов документов.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="type">Тип нового документа.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        private async Task EnsureSequenceAsync(int projectId, string type, CancellationToken cancellationToken = default)
        {
            if (RequiredPreviousType.TryGetValue(type, out var prevType))
            {
                var prevExists = await _context.Documents
                    .AnyAsync(d => d.ProjectId == projectId && d.Type == prevType && d.IsActive && d.IsAccepted, cancellationToken);
                if (!prevExists)
                    throw new InvalidOperationException($"Для создания документа типа '{type}' необходимо наличие активной принятой версии типа '{prevType}'.");
            }
        }

        /// <summary>
        /// Получает все версии всех документов проекта.
        /// </summary>
        public async Task<List<DocumentDto>> GetDocumentsAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            var docs = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .Where(d => d.ProjectId == projectId)
                .OrderBy(d => d.Type)
                .ThenByDescending(d => d.Version)
                .ToListAsync(cancellationToken);
            return docs.Select(MapToDto).ToList();
        }

        /// <summary>
        /// Получает активные версии документов (по одной на тип).
        /// </summary>
        public async Task<List<DocumentDto>> GetActiveDocumentsAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            var docs = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .Where(d => d.ProjectId == projectId && d.IsActive)
                .OrderBy(d => d.Type)
                .ToListAsync(cancellationToken);
            return docs.Select(MapToDto).ToList();
        }

        /// <summary>
        /// Получает все версии документа указанного типа.
        /// </summary>
        public async Task<List<DocumentDto>> GetDocumentVersionsAsync(int projectId, string type, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            var docs = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .Where(d => d.ProjectId == projectId && d.Type == type)
                .OrderByDescending(d => d.Version)
                .ToListAsync(cancellationToken);
            return docs.Select(MapToDto).ToList();
        }

        /// <summary>
        /// Получает документы с пагинацией и фильтрацией по типу.
        /// </summary>
        public async Task<PagedResult<DocumentDto>> GetDocumentsPagedAsync(int projectId, int currentUserId, bool isAdmin, int page, int pageSize, string type = null, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            IQueryable<Document> query = _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .Where(d => d.ProjectId == projectId)
                .AsNoTracking();

            if (!string.IsNullOrEmpty(type))
                query = query.Where(d => d.Type == type);

            var totalCount = await query.CountAsync(cancellationToken);
            var items = await query
                .OrderBy(d => d.Type)
                .ThenByDescending(d => d.Version)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => MapToDto(d))
                .ToListAsync(cancellationToken);

            return new PagedResult<DocumentDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }

        /// <summary>
        /// Выполняет поиск по документам проекта.
        /// </summary>
        public async Task<List<DocumentDto>> SearchDocumentsAsync(int projectId, int currentUserId, bool isAdmin, string query, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            if (string.IsNullOrWhiteSpace(query))
                return new List<DocumentDto>();

            var docs = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .Where(d => d.ProjectId == projectId && (d.Title.Contains(query) || d.Content.Contains(query)))
                .OrderBy(d => d.Type)
                .ThenByDescending(d => d.Version)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
            return docs.Select(MapToDto).ToList();
        }

        /// <summary>
        /// Получает конкретную версию документа по идентификатору.
        /// </summary>
        public async Task<DocumentDto> GetDocumentByIdAsync(int documentId, int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            var doc = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ProjectId == projectId, cancellationToken);
            if (doc == null)
                throw new KeyNotFoundException("Документ не найден.");
            return MapToDto(doc);
        }

        /// <summary>
        /// Создаёт новую версию документа (черновик).
        /// </summary>
        public async Task<DocumentDto> CreateDocumentAsync(int projectId, int currentUserId, bool isAdmin, string type, string title, string content, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            await EnsureProjectNotClosedAsync(projectId, cancellationToken);
            await EnsureSequenceAsync(projectId, type, cancellationToken);

            if (!DocumentTypeConstants.AllTypes.Contains(type))
                throw new ArgumentException($"Недопустимый тип документа: {type}");

            var maxVersion = await _context.Documents
                .Where(d => d.ProjectId == projectId && d.Type == type)
                .MaxAsync(d => (int?)d.Version, cancellationToken) ?? 0;
            var newVersion = maxVersion + 1;

            var document = new Document
            {
                ProjectId = projectId,
                Type = type,
                Version = newVersion,
                Title = title ?? string.Empty,
                Content = content,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedBy = currentUserId,
                IsActive = false,
                IsAccepted = false,
                AcceptedAt = null,
                AcceptedBy = null
            };

            _context.Documents.Add(document);
            await _context.SaveChangesAsync(cancellationToken);

            await _context.Entry(document).Reference(d => d.Creator).LoadAsync(cancellationToken);

            await _auditService.LogAsync(currentUserId, "CreateDocument", "Document", document.Id,
                new { projectId, type, version = document.Version });

            return MapToDto(document);
        }

        /// <summary>
        /// Обновляет черновик документа (только если не принят).
        /// </summary>
        public async Task<DocumentDto> UpdateDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin, string title, string content, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            await EnsureProjectNotClosedAsync(projectId, cancellationToken);

            var doc = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ProjectId == projectId, cancellationToken);
            if (doc == null)
                throw new KeyNotFoundException("Документ не найден.");

            if (doc.IsAccepted)
                throw new InvalidOperationException("Нельзя редактировать принятую версию документа.");

            doc.Title = title ?? doc.Title;
            doc.Content = content;
            doc.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(currentUserId, "UpdateDocument", "Document", documentId,
                new { projectId, type = doc.Type, version = doc.Version });

            return MapToDto(doc);
        }

        /// <summary>
        /// Принимает версию документа (становится активной).
        /// Если тип документа СФС, автоматически запускает скрипт создания структуры.
        /// Если тип документа ИД, запускает асинхронно аналитика для генерации ТТ.
        /// </summary>
        public async Task<DocumentDto> AcceptDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            await EnsureProjectNotClosedAsync(projectId, cancellationToken);

            var doc = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ProjectId == projectId, cancellationToken);

            if (doc == null)
                throw new KeyNotFoundException("Документ не найден.");

            if (doc.IsAccepted)
                throw new InvalidOperationException("Документ уже принят.");

            using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                // Деактивируем предыдущую активную версию этого типа
                var previousActive = await _context.Documents
                    .FirstOrDefaultAsync(d => d.ProjectId == projectId && d.Type == doc.Type && d.IsActive, cancellationToken);
                if (previousActive != null)
                {
                    previousActive.IsActive = false;
                }

                // Устанавливаем новый документ как активный и принятый
                doc.IsActive = true;
                doc.IsAccepted = true;
                doc.AcceptedAt = DateTime.UtcNow;
                doc.AcceptedBy = currentUserId;

                // Если тип документа СФС, запускаем .bat скрипт
                if (doc.Type == DocumentTypeConstants.SFS)
                {
                    await _iaAssistantService.RunBatAsync(projectId, currentUserId, isAdmin, cancellationToken);
                    await _auditService.LogAsync(currentUserId, "RunBatOnAcceptSFS", "Project", projectId,
                        new { DocumentId = documentId, Type = doc.Type });
                }

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                // После успешного принятия ИД запускаем аналитика в фоне для генерации ТТ
                if (doc.Type == DocumentTypeConstants.ID)
                {
                    _ = Task.Run(async () =>
                    {
                        using var scope = _serviceScopeFactory.CreateScope();
                        var analystService = scope.ServiceProvider.GetRequiredService<IAnalystService>();
                        var logger = scope.ServiceProvider.GetRequiredService<ILogger<DocumentService>>();
                        try
                        {
                            await analystService.GenerateTechnicalRequirementsAsync(projectId, currentUserId, isAdmin);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Ошибка фонового запуска аналитика после принятия ИД, проект {ProjectId}", projectId);
                        }
                    });
                }

                // После блока для ИД
                if (doc.Type == DocumentTypeConstants.TT)
                {
                    _ = Task.Run(async () =>
                    {
                        using var scope = _serviceScopeFactory.CreateScope();
                        var analystService = scope.ServiceProvider.GetRequiredService<IAnalystService>();
                        var architectService = scope.ServiceProvider.GetRequiredService<IArchitectService>();
                        var logger = scope.ServiceProvider.GetRequiredService<ILogger<DocumentService>>();
                        try
                        {
                            // Запускаем аналитика (этап 2)
                            await analystService.GenerateAnalysisAsync(projectId, currentUserId, isAdmin);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Ошибка фонового запуска аналитика (анализ) после принятия ТТ, проект {ProjectId}", projectId);
                        }
                        try
                        {
                            // Запускаем архитектора (требуется ИД и ТТ, ИД уже должен быть принят)
                            await architectService.GenerateAsync(projectId, currentUserId, isAdmin);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Ошибка фонового запуска архитектора после принятия ТТ, проект {ProjectId}", projectId);
                        }
                    });
                }

                // Если принят один из архитектурных артефактов – проверяем, все ли четыре приняты
                var architectTypes = new[] 
                { 
                    DocumentTypeConstants.IT, 
                    DocumentTypeConstants.SP, 
                    DocumentTypeConstants.SFS, 
                    DocumentTypeConstants.ER 
                };
                if (architectTypes.Contains(doc.Type))
                {
                    _ = Task.Run(async () =>
                    {
                        using var scope = _serviceScopeFactory.CreateScope();
                        var logger = scope.ServiceProvider.GetRequiredService<ILogger<DocumentService>>();
                        try
                        {
                            var documentService = scope.ServiceProvider.GetRequiredService<IDocumentService>();
                            var developerTaskService = scope.ServiceProvider.GetRequiredService<IDeveloperTaskService>();

                            // Проверяем, что все четыре архитектурных артефакта приняты
                            var activeDocs = await documentService.GetActiveDocumentsAsync(projectId, currentUserId, true);
                            var allAccepted = architectTypes.All(t => activeDocs.Any(d => d.Type == t));
                            if (allAccepted)
                            {
                                logger.LogInformation("Все архитектурные артефакты приняты, запускаем декомпозицию для проекта {ProjectId}", projectId);
                                await developerTaskService.GeneratePlanAsync(projectId, currentUserId, true);
                            }
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Ошибка фоновой декомпозиции после принятия архитектурного артефакта, проект {ProjectId}", projectId);
                        }
                    });
                }

                // Если принят один из тестовых входных документов – проверяем, все ли четыре приняты
                var testerInputTypes = new[]
                {
                    DocumentTypeConstants.AT,
                    DocumentTypeConstants.PI,
                    DocumentTypeConstants.CODE,
                    DocumentTypeConstants.DEV_DOC
                };
                if (testerInputTypes.Contains(doc.Type))
                {
                    _ = Task.Run(async () =>
                    {
                        using var scope = _serviceScopeFactory.CreateScope();
                        var logger = scope.ServiceProvider.GetRequiredService<ILogger<DocumentService>>();
                        try
                        {
                            var documentService = scope.ServiceProvider.GetRequiredService<IDocumentService>();
                            var testerService = scope.ServiceProvider.GetRequiredService<ITesterService>();

                            // Проверяем, что все четыре входных документа приняты
                            var activeDocs = await documentService.GetActiveDocumentsAsync(projectId, currentUserId, true);
                            var allAccepted = testerInputTypes.All(t => activeDocs.Any(d => d.Type == t));
                            if (allAccepted)
                            {
                                logger.LogInformation("Все входные документы тестировщика приняты, запускаем тестировщика для проекта {ProjectId}", projectId);
                                await testerService.GenerateTestArtifactsAsync(projectId, currentUserId, true);
                            }
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Ошибка фонового запуска тестировщика, проект {ProjectId}", projectId);
                        }
                    });
                }

                await _auditService.LogAsync(currentUserId, "AcceptDocument", "Document", documentId,
                    new { projectId, type = doc.Type, version = doc.Version });

                return MapToDto(doc);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }

        /*
        public async Task<DocumentDto> AcceptDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin);
            await EnsureProjectNotClosedAsync(projectId);

            var doc = await _context.Documents
                .Include(d => d.Creator)
                .Include(d => d.Acceptor)
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ProjectId == projectId);

            if (doc == null)
                throw new KeyNotFoundException("Документ не найден.");

            // Нельзя принять уже принятый
            if (doc.IsAccepted)
                throw new InvalidOperationException("Документ уже принят.");

            // Деактивируем предыдущую активную версию этого типа
            var previousActive = await _context.Documents
                .FirstOrDefaultAsync(d => d.ProjectId == projectId && d.Type == doc.Type && d.IsActive);
            if (previousActive != null)
            {
                previousActive.IsActive = false;
            }

            // Устанавливаем новый документ как активный и принятый
            doc.IsActive = true;
            doc.IsAccepted = true;
            doc.AcceptedAt = DateTime.UtcNow;
            doc.AcceptedBy = currentUserId;

            await _context.SaveChangesAsync();

            // Обновляем навигационные свойства для DTO
            await _context.Entry(doc).Reference(d => d.Creator).LoadAsync();
            await _context.Entry(doc).Reference(d => d.Acceptor).LoadAsync();

            await _auditService.LogAsync(currentUserId, "AcceptDocument", "Document", documentId,
                new { projectId, type = doc.Type, version = doc.Version });

            return MapToDto(doc);
        }
        */

        /// <summary>
        /// Удаляет черновик документа (только если не принят).
        /// </summary>
        public async Task DeleteDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAsync(projectId, currentUserId, isAdmin, cancellationToken);
            await EnsureProjectNotClosedAsync(projectId, cancellationToken);

            var doc = await _context.Documents
                .FirstOrDefaultAsync(d => d.Id == documentId && d.ProjectId == projectId, cancellationToken);
            if (doc == null)
                throw new KeyNotFoundException("Документ не найден.");

            if (doc.IsAccepted)
                throw new InvalidOperationException("Нельзя удалить принятую версию документа.");

            _context.Documents.Remove(doc);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(currentUserId, "DeleteDocument", "Document", documentId,
                new { projectId, type = doc.Type, version = doc.Version });
        }

        /// <summary>
        /// Преобразует сущность <see cref="Document"/> в DTO <see cref="DocumentDto"/>.
        /// </summary>
        private DocumentDto MapToDto(Document doc)
        {
            return new DocumentDto
            {
                Id = doc.Id,
                ProjectId = doc.ProjectId,
                Type = doc.Type,
                Version = doc.Version,
                Title = doc.Title,
                Content = doc.Content,
                CreatedAt = doc.CreatedAt,
                UpdatedAt = doc.UpdatedAt,
                CreatedBy = doc.CreatedBy,
                CreatorName = doc.Creator?.Username,
                IsActive = doc.IsActive,
                IsAccepted = doc.IsAccepted,
                AcceptedAt = doc.AcceptedAt,
                AcceptedBy = doc.AcceptedBy,
                AcceptorName = doc.Acceptor?.Username
            };
        }
    }
}