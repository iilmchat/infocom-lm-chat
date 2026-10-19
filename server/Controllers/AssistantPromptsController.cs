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
    /// Контроллер для управления системными промтами ассистентов (только для администраторов).
    /// </summary>
    [ApiController]
    [Route("api/admin/assistant-prompts")]
    [Authorize(Roles = "Admin")]
    public class AssistantPromptsController : ControllerBase
    {
        private readonly IAssistantPromptService _promptService;
        private readonly ILogger<AssistantPromptsController> _logger;

        public AssistantPromptsController(IAssistantPromptService promptService, ILogger<AssistantPromptsController> logger)
        {
            _promptService = promptService;
            _logger = logger;
        }

        /// <summary>
        /// Получить все системные промты.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllPrompts()
        {
            try
            {
                var prompts = await _promptService.GetAllPromptsAsync();
                return Ok(new { success = true, data = prompts });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения списка промтов");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Получить промт для конкретного типа ассистента.
        /// </summary>
        [HttpGet("{assistantType}")]
        public async Task<IActionResult> GetPrompt(string assistantType)
        {
            try
            {
                var prompt = await _promptService.GetPromptAsync(assistantType);
                return Ok(new { success = true, data = prompt });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения промта для {assistantType}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Обновить промт для указанного типа ассистента.
        /// </summary>
        [HttpPut("{assistantType}")]
        public async Task<IActionResult> UpdatePrompt(string assistantType, [FromBody] UpdateAssistantPromptRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { success = false, message = "Не удалось определить пользователя." });

                var updated = await _promptService.UpdatePromptAsync(assistantType, request, userId);
                return Ok(new { success = true, data = updated });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления промта для {assistantType}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}