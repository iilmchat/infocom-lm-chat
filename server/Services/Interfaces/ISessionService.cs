using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис управления сессиями
    /// </summary>
    public interface ISessionService
    {
        Task<List<SessionDto>> GetUserSessionsAsync(int userId);
        Task<bool> EndSessionAsync(int sessionId, int userId);
        Task<bool> EndAllSessionsAsync(int userId);
        Task SaveSessionAsync(int userId, string token, DateTime expiresAt);
        Task<bool> IsTokenValidAsync(string token);
        Task<int?> GetUserIdByTokenAsync(string token);
    }
}