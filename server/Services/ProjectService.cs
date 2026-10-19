using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса управления проектами.
    /// </summary>
    public class ProjectService : IProjectService
    {
        private readonly AppDbContext _context;
        private readonly IOwnerService _ownerService;
        private readonly IAuditService _auditService;

        public ProjectService(AppDbContext context, IOwnerService ownerService, IAuditService auditService)
        {
            _context = context;
            _ownerService = ownerService;
            _auditService = auditService;
        }

        /// <summary>
        /// Создаёт новый проект и добавляет создателя в качестве владельца.
        /// </summary>
        public async Task<ProjectDto> CreateProjectAsync(int creatorId, string name)
        {
            var project = new Project
            {
                Name = name,
                CreatedBy = creatorId,
                Status = ProjectStatus.Active,
                CreatedAt = DateTime.UtcNow
            };

            _context.Projects.Add(project);
            await _context.SaveChangesAsync();

            // Добавляем создателя как владельца
            await _ownerService.AddOwnerAsync(project.Id, creatorId, true, creatorId);

            await _auditService.LogAsync(creatorId, "CreateProject", "Project", project.Id, new { project.Name });

            return await ToDto(project);
        }

        /// <summary>
        /// Получает список проектов с учётом прав доступа.
        /// </summary>
        public async Task<List<ProjectDto>> GetProjectsAsync(int currentUserId, bool isAdmin)
        {
            var query = _context.Projects
                .Include(p => p.Creator)
                .Include(p => p.Owners)
                    .ThenInclude(o => o.User)
                .AsNoTracking();

            if (!isAdmin)
            {
                query = query.Where(p => p.Owners.Any(o => o.UserId == currentUserId));
            }

            var projects = await query.ToListAsync();
            return projects.Select(p => ToDto(p).Result).ToList(); // заменим на асинхронный вариант ниже
        }

        // Переписанный метод без .Result
        public async Task<List<ProjectDto>> GetProjectsAsync(int currentUserId, bool isAdmin)
        {
            var query = _context.Projects
                .AsNoTracking();

            if (!isAdmin)
            {
                query = query.Where(p => p.Owners.Any(o => o.UserId == currentUserId));
            }

            var projects = await query
                .Select(p => new ProjectDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Status = p.Status,
                    CreatedAt = p.CreatedAt,
                    ClosedAt = p.ClosedAt,
                    CreatedBy = p.CreatedBy,
                    CreatorName = p.Creator.Username,
                    Owners = p.Owners.Select(o => new OwnerDto
                    {
                        Id = o.Id,
                        UserId = o.UserId,
                        Username = o.User.Username,
                        AssignedAt = o.AssignedAt
                    }).ToList()
                })
                .ToListAsync();

            return projects;
        }

        /// <summary>
        /// Получает проект по идентификатору с проверкой доступа.
        /// </summary>
        public async Task<ProjectDetailDto> GetProjectByIdAsync(int projectId, int currentUserId, bool isAdmin)
        {
            var project = await _context.Projects
                .AsNoTracking()
                .Include(p => p.Creator)
                .Include(p => p.Owners)
                    .ThenInclude(o => o.User)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет доступа к этому проекту.");

            return await ToDetailDto(project);
        }

        /// <summary>
        /// Обновляет название проекта.
        /// </summary>
        public async Task<ProjectDto> UpdateProjectAsync(int projectId, int currentUserId, bool isAdmin, string newName)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на редактирование этого проекта.");

            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя редактировать закрытый проект.");

            var oldName = project.Name;
            project.Name = newName;
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(currentUserId, "UpdateProject", "Project", projectId,
                new { OldName = oldName, NewName = newName });

            return await ToDto(project);
        }

        /// <summary>
        /// Удаляет проект.
        /// </summary>
        public async Task DeleteProjectAsync(int projectId, int currentUserId, bool isAdmin)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на удаление этого проекта.");

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(currentUserId, "DeleteProject", "Project", projectId, new { project.Name });
        }

        /// <summary>
        /// Закрывает проект.
        /// </summary>
        public async Task CloseProjectAsync(int projectId, int currentUserId, bool isAdmin)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на закрытие этого проекта.");

            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Проект уже закрыт.");

            project.Status = ProjectStatus.Closed;
            project.ClosedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(currentUserId, "CloseProject", "Project", projectId, new { project.Name });
        }

        /// <summary>
        /// Копирует проект со всеми активными принятыми документами.
        /// </summary>
        public async Task<ProjectDto> CopyProjectAsync(int projectId, int currentUserId, bool isAdmin, string newName)
        {
            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на копирование этого проекта.");

            var originalProject = await _context.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (originalProject == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (string.IsNullOrWhiteSpace(newName))
                newName = $"Копия {originalProject.Name}";

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var newProject = new Project
                {
                    Name = newName,
                    Status = ProjectStatus.Active,
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Projects.Add(newProject);
                await _context.SaveChangesAsync();

                var newOwner = new ProjectOwner
                {
                    ProjectId = newProject.Id,
                    UserId = currentUserId,
                    AssignedAt = DateTime.UtcNow
                };
                _context.ProjectOwners.Add(newOwner);
                await _context.SaveChangesAsync();

                var activeAcceptedDocs = await _context.Documents
                    .Where(d => d.ProjectId == projectId && d.IsActive && d.IsAccepted)
                    .AsNoTracking()
                    .ToListAsync();

                foreach (var doc in activeAcceptedDocs)
                {
                    _context.Documents.Add(new Document
                    {
                        ProjectId = newProject.Id,
                        Type = doc.Type,
                        Title = doc.Title,
                        Content = doc.Content,
                        Version = 1,
                        IsActive = false,
                        IsAccepted = false,
                        CreatedBy = currentUserId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                await _auditService.LogAsync(currentUserId, "CopyProject", "Project", newProject.Id,
                    new { OriginalProjectId = projectId, OriginalName = originalProject.Name, NewName = newName });

                return await ToDto(newProject);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Восстанавливает закрытый проект.
        /// </summary>
        public async Task<ProjectDto> RestoreProjectAsync(int projectId, int currentUserId, bool isAdmin)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на восстановление этого проекта.");

            if (project.Status != ProjectStatus.Closed)
                throw new InvalidOperationException("Проект не закрыт, восстановление не требуется.");

            project.Status = ProjectStatus.Active;
            project.ClosedAt = null;
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(currentUserId, "RestoreProject", "Project", projectId, new { project.Name });

            return await ToDto(project);
        }

        /// <summary>
        /// Проверяет, является ли пользователь владельцем проекта.
        /// </summary>
        public async Task<bool> IsProjectOwnerAsync(int projectId, int userId)
        {
            return await _context.ProjectOwners
                .AnyAsync(po => po.ProjectId == projectId && po.UserId == userId);
        }

        /// <summary>
        /// Получает список проектов с пагинацией и фильтром по статусу.
        /// </summary>
        public async Task<PagedResult<ProjectDto>> GetProjectsPagedAsync(
            int currentUserId, bool isAdmin, int page, int pageSize, ProjectStatus? status = null)
        {
            var query = _context.Projects.AsNoTracking();

            if (!isAdmin)
            {
                query = query.Where(p => p.Owners.Any(o => o.UserId == currentUserId));
            }

            if (status.HasValue)
            {
                query = query.Where(p => p.Status == status.Value);
            }

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProjectDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Status = p.Status,
                    CreatedAt = p.CreatedAt,
                    ClosedAt = p.ClosedAt,
                    CreatedBy = p.CreatedBy,
                    CreatorName = p.Creator.Username,
                    Owners = p.Owners.Select(o => new OwnerDto
                    {
                        Id = o.Id,
                        UserId = o.UserId,
                        Username = o.User.Username,
                        AssignedAt = o.AssignedAt
                    }).ToList()
                })
                .ToListAsync();

            return new PagedResult<ProjectDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount
            };
        }

        // Приватные методы преобразования
        private async Task<ProjectDto> ToDto(Project project)
        {
            return new ProjectDto
            {
                Id = project.Id,
                Name = project.Name,
                Status = project.Status,
                CreatedAt = project.CreatedAt,
                ClosedAt = project.ClosedAt,
                CreatedBy = project.CreatedBy,
                CreatorName = (await _context.Users.FindAsync(project.CreatedBy))?.Username,
                Owners = await _context.ProjectOwners
                    .Where(po => po.ProjectId == project.Id)
                    .Include(po => po.User)
                    .Select(po => new OwnerDto
                    {
                        Id = po.Id,
                        UserId = po.UserId,
                        Username = po.User.Username,
                        AssignedAt = po.AssignedAt
                    })
                    .ToListAsync()
            };
        }

        private async Task<ProjectDetailDto> ToDetailDto(Project project)
        {
            return new ProjectDetailDto
            {
                Id = project.Id,
                Name = project.Name,
                Status = project.Status,
                CreatedAt = project.CreatedAt,
                ClosedAt = project.ClosedAt,
                CreatedBy = project.CreatedBy,
                CreatorName = project.Creator?.Username,
                Owners = project.Owners.Select(o => new OwnerDto
                {
                    Id = o.Id,
                    UserId = o.UserId,
                    Username = o.User?.Username,
                    AssignedAt = o.AssignedAt
                }).ToList()
            };
        }
    }
}