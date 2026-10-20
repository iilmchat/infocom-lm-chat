// Controllers/AnalyticsController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер аналитики и статистики
    /// </summary>
    [ApiController]
    [Route("api/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly AnalyticsService _analyticsService;
        private readonly ILogger<AnalyticsController> _logger;

        public AnalyticsController(AnalyticsService analyticsService, ILogger<AnalyticsController> logger)
        {
            _analyticsService = analyticsService;
            _logger = logger;
        }

        /// <summary>
        /// Получение активности пользователя за период
        /// </summary>
        [HttpGet("user/{userId}/activity")]
        public async Task<IActionResult> GetUserActivity(
            string userId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            try
            {
                var fromDate = from ?? DateTime.UtcNow.AddDays(-30);
                var toDate = to ?? DateTime.UtcNow;

                var result = await _analyticsService.GetUserActivityAsync(userId, fromDate, toDate);
                if (result == null)
                    return NotFound(new { error = "Пользователь не найден" });

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения активности пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение вовлечённости в комнате
        /// </summary>
        [HttpGet("room/{roomId}/engagement")]
        public async Task<IActionResult> GetRoomEngagement(
            string roomId,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to)
        {
            try
            {
                var result = await _analyticsService.GetRoomEngagementAsync(roomId, from, to);
                if (result == null)
                    return NotFound(new { error = "Комната не найдена" });

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения вовлечённости комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение глобальной аналитики
        /// </summary>
        [HttpGet("global")]
        public async Task<IActionResult> GetGlobalAnalytics()
        {
            try
            {
                var result = await _analyticsService.GetGlobalAnalyticsAsync();
                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения глобальной аналитики");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}