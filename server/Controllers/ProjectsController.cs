using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    [ApiController]
    [Route("api/projects")]
[Route("api/v1/projects")] // Добавлено в версии 1.2: версионированный маршрут    
    [Authorize] // все методы требуют авторизации
    public class ProjectsController : ControllerBase
    {
        private readonly IProjectService _projectService;
        private readonly ILogger<ProjectsController> _logger;

        public ProjectsController(IProjectService projectService, ILogger<ProjectsController> logger)
        {
            _projectService = projectService;
            _logger = logger;
        }

        private int GetCurrentUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        private bool IsAdmin() => User.IsInRole("Admin");

        // Изменено в версии 1.2: добавлены опциональные параметры пагинации и фильтрации
        [HttpGet]
        public async Task<IActionResult> GetProjects(
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] ProjectStatus? status)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                // Если указаны page и pageSize, используем пагинацию
                if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
                {
                    var paged = await _projectService.GetProjectsPagedAsync(userId, isAdmin, page.Value, pageSize.Value, status);
                    return Ok(new { success = true, data = paged });
                }
                else
                {
                    // Старое поведение: возвращаем все проекты
                var projects = await _projectService.GetProjectsAsync(userId, isAdmin);
                    if (status.HasValue)
                    {
                        projects = projects.Where(p => p.Status == status.Value).ToList();
                    }
                return Ok(new { success = true, data = projects });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения списка проектов");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProject(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var project = await _projectService.GetProjectByIdAsync(id, userId, isAdmin);
                return Ok(new { success = true, data = project });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] ProjectCreateRequest request)
        {
            try
            {
                if (!ModelState.IsValid) return BadRequest(ModelState);
                var userId = GetCurrentUserId();
                var project = await _projectService.CreateProjectAsync(userId, request.Name);
                _logger.LogInformation($"Создан проект {project.Id} пользователем {userId}");
                return Ok(new { success = true, data = project });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка создания проекта");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost("{id}/update")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] ProjectUpdateRequest request)
        {
            try
            {
                if (!ModelState.IsValid) return BadRequest(ModelState);
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var project = await _projectService.UpdateProjectAsync(id, userId, isAdmin, request.Name);
                return Ok(new { success = true, data = project });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost("{id}/delete")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                await _projectService.DeleteProjectAsync(id, userId, isAdmin);
                _logger.LogInformation($"Удалён проект {id} пользователем {userId}");
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost("{id}/close")]
        public async Task<IActionResult> CloseProject(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                await _projectService.CloseProjectAsync(id, userId, isAdmin);
                _logger.LogInformation($"Закрыт проект {id} пользователем {userId}");
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка закрытия проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Создаёт копию проекта.
        /// </summary>
        /// <param name="id">ID исходного проекта</param>
        /// <param name="request">Тело запроса с новым именем (опционально)</param>
        [HttpPost("{id}/copy")]
        public async Task<IActionResult> CopyProject(int id, [FromBody] CopyProjectRequest request)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                var newProject = await _projectService.CopyProjectAsync(id, userId, isAdmin, request.NewName);
                _logger.LogInformation($"Создана копия проекта {id} пользователем {userId}, новый проект {newProject.Id}");
                return Ok(new { success = true, data = newProject });
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
                _logger.LogError(ex, $"Ошибка копирования проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        // Добавлено в версии 1.2: восстановление проекта
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreProject(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var project = await _projectService.RestoreProjectAsync(id, userId, isAdmin);
                _logger.LogInformation($"Восстановлен проект {id} пользователем {userId}");
                return Ok(new { success = true, data = project });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка восстановления проекта {id}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }
    }
}