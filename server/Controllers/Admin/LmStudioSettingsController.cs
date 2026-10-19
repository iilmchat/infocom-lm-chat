using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер для управления настройками LM Studio (только для администраторов).
    /// </summary>
    [ApiController]
    [Route("api/admin/lmstudio-settings")]
    [Authorize(Roles = "Admin")] // только админы
    public class LmStudioSettingsController : ControllerBase
    {
        private readonly ILmStudioSettingsService _settingsService;
        private readonly ILogger<LmStudioSettingsController> _logger;

        public LmStudioSettingsController(ILmStudioSettingsService settingsService, ILogger<LmStudioSettingsController> logger)
        {
            _settingsService = settingsService;
            _logger = logger;
        }

        /// <summary>
        /// Получить текущие настройки LM Studio.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            try
            {
                var settings = await _settingsService.GetSettingsAsync();
                return Ok(new { success = true, data = settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения настроек LM Studio");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Обновить настройки LM Studio.
        /// </summary>
        [HttpPut]
        public async Task<IActionResult> UpdateSettings([FromBody] UpdateLmStudioSettingsRequest request)
        {
            try
            {
                // Получаем ID текущего пользователя из Claims
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { success = false, message = "Не удалось определить пользователя." });

                var updated = await _settingsService.UpdateSettingsAsync(request, userId);
                return Ok(new { success = true, data = updated });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка обновления настроек LM Studio");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}