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
    /// Контроллер для ручного запуска ассистента "Аналитик".
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}/assistant/analyst")]
    [Authorize]
    public class AnalystController : ControllerBase
    {
        private readonly IAnalystService _analystService;
        private readonly IProjectService _projectService;
        private readonly ILogger<AnalystController> _logger;

        public AnalystController(
            IAnalystService analystService,
            IProjectService projectService,
            ILogger<AnalystController> logger)
        {
            _analystService = analystService;
            _projectService = projectService;
            _logger = logger;
        }

        /// <summary>
        /// Запускает генерацию технических требований (ТТ) на основе принятого ИД.
        /// </summary>
        [HttpPost("tt")]
        public async Task<IActionResult> GenerateTT(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                var hasAccess = isAdmin || await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken);
                if (!hasAccess)
                    return Forbid("У вас нет прав на запуск аналитика для этого проекта.");

                var result = await _analystService.GenerateTechnicalRequirementsAsync(projectId, userId, isAdmin, cancellationToken);

                if (result.Success)
                    return Ok(new { success = true, data = result.CreatedDocument });
                else
                    return BadRequest(new { success = false, message = "Генерация ТТ завершилась с ошибкой.", data = result.ErrorDocument });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка ручного запуска аналитика для проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Запускает генерацию аналитических артефактов (АТ, РИСК, ПИ) на основе принятого ТТ.
        /// </summary>
        [HttpPost("analysis")]
        public async Task<IActionResult> GenerateAnalysis(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var isAdmin = User.IsInRole("Admin");

                var hasAccess = isAdmin || await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken);
                if (!hasAccess)
                    return Forbid("У вас нет прав на запуск аналитика для этого проекта.");

                var result = await _analystService.GenerateAnalysisAsync(projectId, userId, isAdmin, cancellationToken);

                if (result.Success)
                    return Ok(new { success = true, data = result.CreatedDocuments });
                else
                    return BadRequest(new { success = false, message = "Генерация анализа завершилась с ошибкой.", data = result.ErrorDocument });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка ручного запуска аналитика (анализ) для проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }        
    }
}