using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис управления проектами.
    /// </summary>
    public interface IProjectService
    {
        Task<ProjectDto> CreateProjectAsync(int creatorId, string name, CancellationToken cancellationToken = default);
        Task<List<ProjectDto>> GetProjectsAsync(int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
        Task<ProjectDetailDto> GetProjectByIdAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
        Task<ProjectDto> UpdateProjectAsync(int projectId, int currentUserId, bool isAdmin, string newName, CancellationToken cancellationToken = default);
        Task DeleteProjectAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
        Task CloseProjectAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
        Task<bool> IsProjectOwnerAsync(int projectId, int userId, CancellationToken cancellationToken = default);
        Task<ProjectDto> CopyProjectAsync(int projectId, int currentUserId, bool isAdmin, string newName, CancellationToken cancellationToken = default);
        Task<PagedResult<ProjectDto>> GetProjectsPagedAsync(int currentUserId, bool isAdmin, int page, int pageSize, ProjectStatus? status = null, CancellationToken cancellationToken = default);
        Task<ProjectDto> RestoreProjectAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
    }
}