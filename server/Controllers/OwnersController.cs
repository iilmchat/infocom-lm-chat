using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ProjectManager.API.DTOs;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Controllers
{
    [ApiController]
    [Route("api/projects/{projectId}/owners")]
    [Authorize]
    public class OwnersController : ControllerBase
    {
        private readonly IOwnerService _ownerService;
        private readonly ILogger<OwnersController> _logger;

        public OwnersController(IOwnerService ownerService, ILogger<OwnersController> logger)
        {
            _ownerService = ownerService;
            _logger = logger;
        }

        private int GetCurrentUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        private bool IsAdmin() => User.IsInRole("Admin");

        [HttpGet]
        public async Task<IActionResult> GetOwners(int projectId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var owners = await _ownerService.GetOwnersAsync(projectId, userId, isAdmin);
                return Ok(new { success = true, data = owners });
            }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения владельцев проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddOwner(int projectId, [FromBody] AddOwnerRequest request)
        {
            try
            {
                if (!ModelState.IsValid) return BadRequest(ModelState);
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var owner = await _ownerService.AddOwnerAsync(projectId, userId, isAdmin, request.UserId);
                _logger.LogInformation($"Добавлен владелец {request.UserId} в проект {projectId}");
                return Ok(new { success = true, data = owner });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка добавления владельца в проект {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        [HttpPost("{ownerId}/remove")]
        public async Task<IActionResult> RemoveOwner(int projectId, int ownerId)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                await _ownerService.RemoveOwnerAsync(projectId, userId, isAdmin, ownerId);
                _logger.LogInformation($"Удалён владелец {ownerId} из проекта {projectId}");
                return Ok(new { success = true });
            }
            catch (KeyNotFoundException ex) { return NotFound(new { success = false, message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(new { success = false, message = ex.Message }); }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления владельца {ownerId} из проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }
    }
}