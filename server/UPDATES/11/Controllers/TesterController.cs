using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер для запуска ИИ-ассистента "Тестировщик".
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}/assistant/tester")]
    [Authorize]
    public class TesterController : ControllerBase
    {
        private readonly ITesterService _testerService;
        private readonly IProjectService _projectService;
        private readonly ILogger<TesterController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="TesterController"/>.
        /// </summary>
        public TesterController(
            ITesterService testerService,
            IProjectService projectService,
            ILogger<TesterController> logger)
        {
            _testerService = testerService;
            _projectService = projectService;
            _logger = logger;
        }

        /// <summary>
        /// Запускает генерацию тестовых артефактов (ТП, ТК, ОТ).
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

                var hasAccess = isAdmin || await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken);
                if (!hasAccess)
                    return Forbid("У вас нет прав на запуск тестировщика для этого проекта.");

                var result = await _testerService.GenerateTestArtifactsAsync(projectId, userId, isAdmin, cancellationToken);

                if (result.Success)
                    return Ok(new { success = true, data = result.CreatedDocuments });
                else
                    return BadRequest(new { success = false, message = "Генерация тестовых артефактов завершилась с ошибкой.", data = result.ErrorDocument });
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
                _logger.LogError(ex, "Ошибка запуска тестировщика для проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}