using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер для запуска ИИ-ассистента архитектора.
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}/assistant/architect")]
    [Authorize]
    public class ArchitectController : ControllerBase
    {
        private readonly IArchitectService _architectService;
        private readonly IProjectService _projectService;
        private readonly ILogger<ArchitectController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="ArchitectController"/>.
        /// </summary>
        /// <param name="architectService">Сервис архитектора.</param>
        /// <param name="projectService">Сервис проектов (для проверки прав).</param>
        /// <param name="logger">Логгер.</param>
        public ArchitectController(
            IArchitectService architectService,
            IProjectService projectService,
            ILogger<ArchitectController> logger)
        {
            _architectService = architectService;
            _projectService = projectService;
            _logger = logger;
        }

        /// <summary>
        /// Запускает генерацию артефактов архитектором для указанного проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат генерации.</returns>
        [HttpPost]
        public async Task<IActionResult> Generate(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                // Проверяем права: владелец или админ
                var hasAccess = isAdmin || await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken);
                if (!hasAccess)
                    return Forbid("У вас нет прав на запуск архитектора для этого проекта.");

                var result = await _architectService.GenerateAsync(projectId, userId, isAdmin, cancellationToken);

                if (result.Success)
                {
                    return Ok(new { success = true, data = result.CreatedDocuments });
                }
                else
                {
                    // Возвращаем 400 с информацией об ошибке, но в теле также можно передать документ ошибки
                    return BadRequest(new { success = false, message = "Генерация завершилась с ошибкой.", data = result.ErrorDocument });
                }
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при запуске архитектора для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}