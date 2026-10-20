// Services/SessionService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис управления сессиями пользователей
    /// </summary>
    public class SessionService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<SessionService> _logger;

        public SessionService(ChatDbContext context, ILogger<SessionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Создание новой сессии
        /// </summary>
        public async Task<UserSession> CreateSessionAsync(string userId, string deviceName, string deviceType, string ipAddress, string userAgent)
        {
            try
            {
                var session = new UserSession
                {
                    UserId = userId,
                    DeviceName = deviceName,
                    DeviceType = deviceType,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    CreatedAt = DateTime.UtcNow,
                    LastActivity = DateTime.UtcNow,
                    IsActive = true,
                    ExpiresAt = DateTime.UtcNow.AddDays(7) // сессия живёт 7 дней
                };

                await _context.UserSessions.AddAsync(session);
                await _context.SaveChangesAsync();

                return session;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка создания сессии для {userId}");
                throw;
            }
        }

        /// <summary>
        /// Получение всех активных сессий пользователя
        /// </summary>
        public async Task<List<SessionDto>> GetUserSessionsAsync(string userId)
        {
            try
            {
                var sessions = await _context.UserSessions
                    .Where(s => s.UserId == userId && s.IsActive)
                    .OrderByDescending(s => s.LastActivity)
                    .ToListAsync();

                return sessions.Select(s => new SessionDto
                {
                    SessionId = s.SessionId,
                    DeviceName = s.DeviceName,
                    DeviceType = s.DeviceType,
                    IpAddress = s.IpAddress,
                    CreatedAt = s.CreatedAt,
                    LastActivity = s.LastActivity,
                    IsActive = s.IsActive,
                    ExpiresAt = s.ExpiresAt
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сессий пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Завершение сессии
        /// </summary>
        public async Task<bool> EndSessionAsync(string sessionId, string userId)
        {
            try
            {
                var session = await _context.UserSessions
                    .FirstOrDefaultAsync(s => s.SessionId == sessionId && s.UserId == userId);

                if (session == null) return false;

                session.IsActive = false;
                session.ExpiresAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка завершения сессии {sessionId}");
                return false;
            }
        }

        /// <summary>
        /// Завершение всех сессий пользователя
        /// </summary>
        public async Task<bool> EndAllSessionsAsync(string userId)
        {
            try
            {
                var sessions = await _context.UserSessions
                    .Where(s => s.UserId == userId && s.IsActive)
                    .ToListAsync();

                foreach (var s in sessions)
                {
                    s.IsActive = false;
                    s.ExpiresAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка завершения всех сессий для {userId}");
                return false;
            }
        }

        /// <summary>
        /// Обновление времени последней активности сессии
        /// </summary>
        public async Task UpdateSessionActivityAsync(string sessionId)
        {
            try
            {
                var session = await _context.UserSessions
                    .FirstOrDefaultAsync(s => s.SessionId == sessionId);

                if (session != null && session.IsActive)
                {
                    session.LastActivity = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления активности сессии {sessionId}");
            }
        }

        /// <summary>
        /// Очистка просроченных сессий
        /// </summary>
        public async Task<int> CleanupExpiredSessionsAsync()
        {
            try
            {
                var expired = await _context.UserSessions
                    .Where(s => s.IsActive && s.ExpiresAt < DateTime.UtcNow)
                    .ToListAsync();

                foreach (var s in expired)
                {
                    s.IsActive = false;
                }

                await _context.SaveChangesAsync();
                return expired.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка очистки просроченных сессий");
                return 0;
            }
        }
    }
}