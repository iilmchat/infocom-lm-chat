using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Services.Interfaces;
using System.Security.Claims;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер аутентификации и управления сессиями
    /// </summary>
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ISessionService _sessionService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            IAuthService authService,
            ISessionService sessionService,
            ILogger<AuthController> logger)
        {
            _authService = authService;
            _sessionService = sessionService;
            _logger = logger;
        }

        /// <summary>
        /// Регистрация нового пользователя
        /// </summary>
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var response = await _authService.RegisterAsync(request);
                _logger.LogInformation($"Зарегистрирован новый пользователь: {response.Username} (ID: {response.UserId})");
                return Ok(new { success = true, data = response });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при регистрации пользователя");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Вход в систему
        /// </summary>
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var response = await _authService.LoginAsync(request);
                _logger.LogInformation($"Пользователь {response.Username} (ID: {response.UserId}) выполнил вход");
                return Ok(new { success = true, data = response });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при входе пользователя");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Получение активных сессий пользователя (только для владельца или админа).
        /// </summary>
        /// <param name="userId">Опциональный идентификатор пользователя. Если не указан, берётся текущий.</param>
        /// <returns>Список сессий.</returns>
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] int? userId)
        {
            try
            {
                var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                // Если указан userId и он не совпадает с текущим, то только админ может запрашивать чужие сессии
                if (userId.HasValue && userId.Value != currentUserId && !isAdmin)
                    return Forbid("Вы не можете просматривать сессии другого пользователя.");

                var targetUserId = userId ?? currentUserId;
                var sessions = await _sessionService.GetUserSessionsAsync(targetUserId);
                return Ok(new { success = true, data = sessions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сессий для userId={userId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /*
        /// <summary>
        /// Получение активных сессий пользователя (только для владельца или админа)
        /// </summary>
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] int userId)
        {
            try
            {
                // Здесь должна быть проверка прав: только сам пользователь или админ
                // Пока пропускаем, позже добавим авторизацию

                var sessions = await _sessionService.GetUserSessionsAsync(userId);
                return Ok(new { success = true, data = sessions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сессий для userId={userId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
        */

        /// <summary>
        /// Завершение конкретной сессии (POST вместо DELETE)
        /// </summary>
        [HttpPost("sessions/end")]
        public async Task<IActionResult> EndSession([FromBody] EndSessionRequest request, [FromQuery] int sessionId)
        {
            try
            {
                if (sessionId <= 0)
                    return BadRequest(new { success = false, message = "Неверный идентификатор сессии." });

                var result = await _sessionService.EndSessionAsync(sessionId, request.UserId);
                if (!result)
                    return NotFound(new { success = false, message = "Сессия не найдена или уже завершена." });

                _logger.LogInformation($"Сессия {sessionId} завершена для пользователя {request.UserId}");
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка завершения сессии {sessionId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
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
                var result = await _sessionService.EndAllSessionsAsync(request.UserId);
                if (!result)
                    return NotFound(new { success = false, message = "Пользователь не найден или нет активных сессий." });

                _logger.LogInformation($"Все сессии пользователя {request.UserId} завершены");
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка выхода из всех устройств для userId={request.UserId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}