// Services/NotificationService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис уведомлений пользователей
    /// </summary>
    public class NotificationService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(ChatDbContext context, ILogger<NotificationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Создание уведомления для пользователя
        /// </summary>
        public async Task<Notification> CreateNotificationAsync(
            string userId,
            string type,
            string title,
            string body,
            object data = null)
        {
            try
            {
                var notification = new Notification
                {
                    UserId = userId,
                    Type = type,
                    Title = title,
                    Body = body,
                    DataJson = data != null ? JsonSerializer.Serialize(data) : "{}",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                await _context.Notifications.AddAsync(notification);
                await _context.SaveChangesAsync();

                return notification;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка создания уведомления для {userId}");
                throw;
            }
        }

        /// <summary>
        /// Получение всех уведомлений пользователя
        /// </summary>
        public async Task<List<NotificationDto>> GetUserNotificationsAsync(string userId, bool onlyUnread = false, int limit = 50)
        {
            try
            {
                var query = _context.Notifications
                    .Where(n => n.UserId == userId);

                if (onlyUnread)
                    query = query.Where(n => !n.IsRead);

                var notifications = await query
                    .OrderByDescending(n => n.CreatedAt)
                    .Take(limit)
                    .ToListAsync();

                return notifications.Select(n => new NotificationDto
                {
                    NotificationId = n.NotificationId,
                    Type = n.Type,
                    Title = n.Title,
                    Body = n.Body,
                    Data = !string.IsNullOrEmpty(n.DataJson) ? JsonSerializer.Deserialize<object>(n.DataJson) : null,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    ReadAt = n.ReadAt
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения уведомлений для {userId}");
                throw;
            }
        }

        /// <summary>
        /// Получение количества непрочитанных уведомлений
        /// </summary>
        public async Task<int> GetUnreadCountAsync(string userId)
        {
            try
            {
                return await _context.Notifications
                    .CountAsync(n => n.UserId == userId && !n.IsRead);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения количества непрочитанных для {userId}");
                throw;
            }
        }

        /// <summary>
        /// Отметка уведомлений как прочитанных
        /// </summary>
        public async Task<bool> MarkAsReadAsync(string userId, List<string> notificationIds = null)
        {
            try
            {
                var query = _context.Notifications
                    .Where(n => n.UserId == userId && !n.IsRead);

                if (notificationIds != null && notificationIds.Any())
                    query = query.Where(n => notificationIds.Contains(n.NotificationId));

                var notifications = await query.ToListAsync();

                foreach (var n in notifications)
                {
                    n.IsRead = true;
                    n.ReadAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка отметки уведомлений как прочитанных для {userId}");
                return false;
            }
        }

        /// <summary>
        /// Удаление старых уведомлений (очистка)
        /// </summary>
        public async Task<int> CleanupOldNotificationsAsync(int daysOld = 30)
        {
            try
            {
                var cutoff = DateTime.UtcNow.AddDays(-daysOld);
                var old = await _context.Notifications
                    .Where(n => n.CreatedAt < cutoff && n.IsRead)
                    .ToListAsync();

                _context.Notifications.RemoveRange(old);
                await _context.SaveChangesAsync();

                return old.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка очистки старых уведомлений");
                return 0;
            }
        }

        /// <summary>
        /// Создание уведомления о упоминании
        /// </summary>
        public async Task CreateMentionNotificationAsync(string userId, string mentionedBy, string messageId, string roomId)
        {
            try
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);
                var mentionedByUser = await _context.Users.FirstOrDefaultAsync(u => u.UserId == mentionedBy);
                var room = await _context.Rooms.FirstOrDefaultAsync(r => r.RoomId == roomId);

                var title = $"Упоминание от {mentionedByUser?.Name ?? mentionedBy}";
                var body = $"Вас упомянули в комнате {room?.Name ?? roomId}";

                await CreateNotificationAsync(userId, "mention", title, body, new
                {
                    MessageId = messageId,
                    RoomId = roomId,
                    MentionedBy = mentionedBy
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка создания уведомления о упоминании для {userId}");
            }
        }
    }
}