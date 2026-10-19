using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис управления владельцами проектов.
    /// </summary>
    public interface IOwnerService
    {
        Task<List<OwnerDto>> GetOwnersAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
        Task<OwnerDto> AddOwnerAsync(int projectId, int currentUserId, bool isAdmin, int newOwnerId, CancellationToken cancellationToken = default);
        Task RemoveOwnerAsync(int projectId, int currentUserId, bool isAdmin, int ownerId, CancellationToken cancellationToken = default);
    }
}