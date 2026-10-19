using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер для эндпоинтов ИИ-ассистентов (работа с файлами и Git).
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}")]
    public class IaController : ControllerBase
    {
        private readonly IIaAssistantService _iaService;
        private readonly ILogger<IaController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="IaController"/>.
        /// </summary>
        /// <param name="iaService">Сервис ИИ-ассистента.</param>
        /// <param name="logger">Логгер.</param>
        public IaController(IIaAssistantService iaService, ILogger<IaController> logger)
        {
            _iaService = iaService;
            _logger = logger;
        }

        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        private bool IsAdmin() => User.IsInRole("Admin");

        /// <summary>
        /// Запускает .bat-скрипт для создания структуры проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат выполнения скрипта.</returns>
        [HttpPost("run-bat")]
        public async Task<IActionResult> RunBat(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                var result = await _iaService.RunBatAsync(projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = result });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (FileNotFoundException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (TimeoutException)
            {
                return StatusCode(500, new { success = false, message = "Время выполнения скрипта истекло." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при выполнении run-bat для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Сохраняет файл в проекте.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="request">Данные файла (путь и содержимое).</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат сохранения.</returns>
        [HttpPost("code")]
        public async Task<IActionResult> SaveCode(
            int projectId,
            [FromBody] SaveCodeRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                var result = await _iaService.SaveCodeAsync(
                    projectId, userId, isAdmin, request.Path, request.Content, cancellationToken);
                return Ok(new { success = true, data = result });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при сохранении файла для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Выполняет git add и commit в репозитории проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="request">Данные коммита (сообщение).</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Хэш коммита.</returns>
        [HttpPost("commit")]
        public async Task<IActionResult> Commit(
            int projectId,
            [FromBody] CommitRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                
                var result = await _iaService.CommitAsync(
                    projectId, userId, isAdmin, request.Message, cancellationToken);
                return Ok(new { success = true, data = result });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при выполнении коммита для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}