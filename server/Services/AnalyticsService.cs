// Services/AnalyticsService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис аналитики и статистики
    /// </summary>
    public class AnalyticsService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<AnalyticsService> _logger;

        public AnalyticsService(ChatDbContext context, ILogger<AnalyticsService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Получение активности пользователя за период
        /// </summary>
        public async Task<UserActivityDto> GetUserActivityAsync(string userId, DateTime from, DateTime to)
        {
            try
            {
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.UserId == userId);
                if (user == null) return null;

                var messages = await _context.Messages
                    .Where(m => m.UserId == userId && m.Timestamp >= from && m.Timestamp <= to)
                    .ToListAsync();

                var daily = messages
                    .GroupBy(m => m.Timestamp.Date)
                    .ToDictionary(g => g.Key, g => g.Count());

                var rooms = messages
                    .GroupBy(m => m.RoomId)
                    .ToDictionary(g => g.Key, g => g.Count());

                return new UserActivityDto
                {
                    UserId = userId,
                    UserName = user.Name,
                    TotalMessages = messages.Count,
                    MessagesPerDay = messages.Count / Math.Max(1, (to - from).Days),
                    ActiveDays = daily.Count,
                    From = from,
                    To = to,
                    DailyActivity = daily,
                    RoomsActivity = rooms
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения активности пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Получение вовлечённости в комнате
        /// </summary>
        public async Task<RoomEngagementDto> GetRoomEngagementAsync(string roomId, DateTime? from = null, DateTime? to = null)
        {
            try
            {
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);
                if (room == null) return null;

                var query = _context.Messages.AsQueryable();
                query = query.Where(m => m.RoomId == roomId);
                if (from.HasValue) query = query.Where(m => m.Timestamp >= from.Value);
                if (to.HasValue) query = query.Where(m => m.Timestamp <= to.Value);

                var messages = await query.ToListAsync();

                var hourly = messages
                    .GroupBy(m => m.Timestamp.Hour)
                    .ToDictionary(g => g.Key, g => g.Count());

                var topUsers = messages
                    .GroupBy(m => m.UserId)
                    .OrderByDescending(g => g.Count())
                    .Take(5)
                    .Select(g => g.Key)
                    .ToList();

                var peakHour = messages
                    .GroupBy(m => m.Timestamp.Hour)
                    .OrderByDescending(g => g.Count())
                    .FirstOrDefault();

                return new RoomEngagementDto
                {
                    RoomId = roomId,
                    RoomName = room.Name,
                    UniqueUsers = messages.Select(m => m.UserId).Distinct().Count(),
                    TotalMessages = messages.Count,
                    AverageMessageLength = messages.Any() ? messages.Average(m => m.Content?.Length ?? 0) : 0,
                    HourlyDistribution = hourly,
                    PeakHour = peakHour != null ? new DateTime(1, 1, 1, peakHour.Key, 0, 0) : DateTime.MinValue,
                    TopUsers = topUsers
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения вовлечённости комнаты {roomId}");
                throw;
            }
        }

        /// <summary>
        /// Получение глобальной аналитики
        /// </summary>
        public async Task<GlobalAnalyticsDto> GetGlobalAnalyticsAsync()
        {
            try
            {
                var today = DateTime.UtcNow.Date;
                var monthAgo = today.AddDays(-30);

                var totalUsers = await _context.Users.CountAsync();
                var onlineUsers = await _context.Users.CountAsync(u => u.IsOnline);
                var totalMessages = await _context.Messages.CountAsync();
                var messagesToday = await _context.Messages.CountAsync(m => m.Timestamp >= today);
                var activeRooms = await _context.Rooms.CountAsync(r => r.IsActive);

                var dailyMessages = await _context.Messages
                    .Where(m => m.Timestamp >= monthAgo)
                    .GroupBy(m => m.Timestamp.Date)
                    //.Select(g => new { Date = g.Key, Count = g.Count() })
                    //.ToDictionaryAsync(k => k.Date, v => v.Count);
                    .Select(g => new MessageCountDto // Проецируем сразу в ваш DTO
                    {
                        MessageDate = g.Key,
                        MessageCount = g.Count()
                    })
                    .OrderByDescending(x => x.MessageDate) // Опционально: сортировка от новых к старым
                    .ToListAsync();

                var dau = await _context.Users
                    .Where(u => u.LastSeen >= today)
                    .CountAsync();

                var mau = await _context.Users
                    .Where(u => u.LastSeen >= monthAgo)
                    .CountAsync();

                return new GlobalAnalyticsDto
                {
                    DailyActiveUsers = dau,
                    MonthlyActiveUsers = mau,
                    TotalUsers = totalUsers,
                    TotalMessages = totalMessages,
                    MessagesToday = messagesToday,
                    MessagesPerDay = dailyMessages,
                    OnlineUsers = onlineUsers,
                    ActiveRooms = activeRooms
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения глобальной аналитики");
                throw;
            }
        }
    }
}