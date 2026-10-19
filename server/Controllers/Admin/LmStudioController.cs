using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers.Admin
{
    /// <summary>
    /// Контроллер для административного управления LM Studio (проверка здоровья, список моделей).
    /// </summary>
    [ApiController]
    [Route("api/admin/lmstudio")]
    [Authorize(Roles = "Admin")]
    public class LmStudioController : ControllerBase
    {
        private readonly ILmStudioClient _lmStudioClient;
        private readonly ILogger<LmStudioController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioController"/>.
        /// </summary>
        /// <param name="lmStudioClient">Клиент LM Studio.</param>
        /// <param name="logger">Логгер.</param>
        public LmStudioController(ILmStudioClient lmStudioClient, ILogger<LmStudioController> logger)
        {
            _lmStudioClient = lmStudioClient;
            _logger = logger;
        }

        /// <summary>
        /// Проверяет доступность LM Studio.
        /// </summary>
        /// <returns>Статус доступности.</returns>
        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            try
            {
                var isHealthy = await _lmStudioClient.IsHealthyAsync();
                return Ok(new { success = true, data = new { isHealthy } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при проверке здоровья LM Studio");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Получает список моделей, доступных на сервере LM Studio.
        /// </summary>
        /// <returns>Список моделей.</returns>
        [HttpGet("models")]
        public async Task<IActionResult> Models()
        {
            try
            {
                var models = await _lmStudioClient.GetAvailableModelsAsync();
                return Ok(new { success = true, data = models });
            }
            catch (ProjectManager.API.Exceptions.LmStudioUnavailableException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при получении списка моделей");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}