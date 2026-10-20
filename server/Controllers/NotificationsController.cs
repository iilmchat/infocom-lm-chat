// Controllers/NotificationsController.cs

using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер уведомлений
    /// </summary>
    [ApiController]
    [Route("api/notifications")]
    public class NotificationsController : ControllerBase
    {
        private readonly NotificationService _notificationService;
        private readonly ILogger<NotificationsController> _logger;

        public NotificationsController(NotificationService notificationService, ILogger<NotificationsController> logger)
        {
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Получение уведомлений пользователя
        /// </summary>
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserNotifications(
            string userId,
            [FromQuery] bool onlyUnread = false,
            [FromQuery] int limit = 50)
        {
            try
            {
                var notifications = await _notificationService.GetUserNotificationsAsync(userId, onlyUnread, limit);
                var unreadCount = await _notificationService.GetUnreadCountAsync(userId);

                return Ok(new
                {
                    success = true,
                    notifications,
                    unreadCount,
                    total = notifications.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения уведомлений для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Отметка уведомлений как прочитанных
        /// </summary>
        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkNotificationsAsRead([FromBody] MarkNotificationsReadRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _notificationService.MarkAsReadAsync(request.UserId, request.NotificationIds.ToList());
                var unreadCount = await _notificationService.GetUnreadCountAsync(request.UserId);

                return Ok(new
                {
                    success = result,
                    unreadCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отметки уведомлений как прочитанных");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение количества непрочитанных уведомлений
        /// </summary>
        [HttpGet("count/{userId}")]
        public async Task<IActionResult> GetUnreadCount(string userId)
        {
            try
            {
                var count = await _notificationService.GetUnreadCountAsync(userId);
                return Ok(new { success = true, unreadCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения количества непрочитанных для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}