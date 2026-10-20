// Controllers/AuthController.cs

using System;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер аутентификации и управления сессиями
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly SessionService _sessionService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(SessionService sessionService, ILogger<AuthController> logger)
        {
            _sessionService = sessionService;
            _logger = logger;
        }

        /// <summary>
        /// Получение активных сессий пользователя
        /// </summary>
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var sessions = await _sessionService.GetUserSessionsAsync(userId);
                return Ok(new { success = true, sessions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сессий для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Завершение сессии
        /// </summary>
        [HttpDelete("sessions/{sessionId}")]
        public async Task<IActionResult> EndSession(string sessionId, [FromQuery] string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _sessionService.EndSessionAsync(sessionId, userId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка завершения сессии {sessionId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Завершение всех сессий пользователя (выход из всех устройств)
        /// </summary>
        [HttpPost("logout-all")]
        public async Task<IActionResult> LogoutAll([FromBody] EndSessionRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _sessionService.EndAllSessionsAsync(request.UserId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка выхода из всех устройств для {request?.UserId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}