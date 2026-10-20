// Controllers/SettingsController.cs

using System;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер управления системными настройками (админ)
    /// </summary>
    [ApiController]
    [Route("api/admin/settings")]
    public class SettingsController : ControllerBase
    {
        private readonly SettingsService _settingsService;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(SettingsService settingsService, ILogger<SettingsController> logger)
        {
            _settingsService = settingsService;
            _logger = logger;
        }

        /// <summary>
        /// Получение всех настроек
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllSettings()
        {
            try
            {
                var settings = await _settingsService.GetAllSettingsAsync();
                return Ok(new { success = true, settings });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения всех настроек");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение настройки по ключу
        /// </summary>
        [HttpGet("{key}")]
        public async Task<IActionResult> GetSetting(string key)
        {
            try
            {
                var setting = await _settingsService.GetSettingAsync(key);
                if (setting == null)
                    return NotFound(new { error = "Настройка не найдена" });

                return Ok(new { success = true, setting });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения настройки {key}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Обновление существующей настройки
        /// </summary>
        [HttpPut("{key}")]
        public async Task<IActionResult> UpdateSetting(string key, [FromBody] SetSystemSettingRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Value))
                    return BadRequest(new { error = "Value обязателен" });

                var result = await _settingsService.SetSettingAsync(key, request.Value, request.Description);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления настройки {key}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Добавление новой настройки
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateSetting([FromBody] SetSystemSettingRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Key) || string.IsNullOrWhiteSpace(request.Value))
                    return BadRequest(new { error = "Key и Value обязательны" });

                var result = await _settingsService.SetSettingAsync(request.Key, request.Value, request.Description);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка добавления настройки");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Удаление настройки
        /// </summary>
        [HttpDelete("{key}")]
        public async Task<IActionResult> DeleteSetting(string key)
        {
            try
            {
                var result = await _settingsService.DeleteSettingAsync(key);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления настройки {key}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}