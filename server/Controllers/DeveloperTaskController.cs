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
    /// Контроллер для управления планом задач разработчика.
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}/assistant/developer")]
    [Authorize]
    public class DeveloperTaskController : ControllerBase
    {
        private readonly IDeveloperTaskService _developerTaskService;
        private readonly IProjectService _projectService;
        private readonly ILogger<DeveloperTaskController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="DeveloperTaskController"/>.
        /// </summary>
        /// <param name="developerTaskService">Сервис задач разработчика.</param>
        /// <param name="projectService">Сервис проектов (для проверки прав).</param>
        /// <param name="logger">Логгер.</param>
        public DeveloperTaskController(
            IDeveloperTaskService developerTaskService,
            IProjectService projectService,
            ILogger<DeveloperTaskController> logger)
        {
            _developerTaskService = developerTaskService;
            _projectService = projectService;
            _logger = logger;
        }

        /// <summary>
        /// Получает ID текущего пользователя из claims.
        /// </summary>
        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

        /// <summary>
        /// Проверяет, является ли текущий пользователь администратором.
        /// </summary>
        private bool IsAdmin() => User.IsInRole("Admin");

        /// <summary>
        /// Генерирует план задач разработчика на основе принятых архитектурных артефактов.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список созданных задач.</returns>
        [HttpPost("plan")]
        public async Task<IActionResult> GeneratePlan(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на декомпозицию для этого проекта.");

                var tasks = await _developerTaskService.GeneratePlanAsync(projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = tasks });
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
                _logger.LogError(ex, "Ошибка генерации плана задач для проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Запускает выполнение конкретной задачи разработчика.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        [HttpPost("tasks/{taskId}/run")]
        public async Task<IActionResult> RunTask(int projectId, int taskId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на выполнение задач этого проекта.");

                var task = await _developerTaskService.RunTaskAsync(taskId, projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = task });
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
                _logger.LogError(ex, "Ошибка выполнения задачи {TaskId} проекта {ProjectId}", taskId, projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Подтверждает результат выполнения задачи.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        [HttpPost("tasks/{taskId}/approve")]
        public async Task<IActionResult> ApproveTask(int projectId, int taskId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на подтверждение задач этого проекта.");

                var task = await _developerTaskService.ApproveTaskAsync(taskId, projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = task });
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
                _logger.LogError(ex, "Ошибка подтверждения задачи {TaskId} проекта {ProjectId}", taskId, projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Отклоняет результат выполнения задачи с комментарием.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="request">Тело запроса с комментарием.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        [HttpPost("tasks/{taskId}/reject")]
        public async Task<IActionResult> RejectTask(
            int projectId,
            int taskId,
            [FromBody] RejectDeveloperTaskRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Comment))
                    return BadRequest(new { success = false, message = "Комментарий обязателен." });

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на отклонение задач этого проекта.");

                var task = await _developerTaskService.RejectTaskAsync(taskId, projectId, userId, isAdmin, request.Comment, cancellationToken);
                return Ok(new { success = true, data = task });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
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
                _logger.LogError(ex, "Ошибка отклонения задачи {TaskId} проекта {ProjectId}", taskId, projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Получает список задач проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список задач.</returns>
        [HttpGet("tasks")]
        public async Task<IActionResult> GetTasks(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на просмотр задач этого проекта.");

                var tasks = await _developerTaskService.GetTasksAsync(projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = tasks });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения задач проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Обновляет задачу (ручная корректировка владельцем).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="request">Данные для обновления.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        [HttpPut("tasks/{taskId}")]
        public async Task<IActionResult> UpdateTask(
            int projectId,
            int taskId,
            [FromBody] UpdateDeveloperTaskRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на изменение задач этого проекта.");

                var task = await _developerTaskService.UpdateTaskAsync(taskId, projectId, userId, isAdmin, request, cancellationToken);
                return Ok(new { success = true, data = task });
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
                _logger.LogError(ex, "Ошибка обновления задачи {TaskId} проекта {ProjectId}", taskId, projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }

        /// <summary>
        /// Утверждает план задач (владелец подтверждает последовательность).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список утверждённых задач.</returns>
        [HttpPost("plan/approve")]
        public async Task<IActionResult> ApprovePlan(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (!isAdmin && !await _projectService.IsProjectOwnerAsync(projectId, userId, cancellationToken))
                    return Forbid("У вас нет прав на утверждение плана этого проекта.");

                var tasks = await _developerTaskService.ApprovePlanAsync(projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = tasks });
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
                _logger.LogError(ex, "Ошибка утверждения плана задач проекта {ProjectId}", projectId);
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка сервера." });
            }
        }
    }
}