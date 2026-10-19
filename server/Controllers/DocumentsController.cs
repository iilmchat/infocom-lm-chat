using System;
using System.Collections.Generic;
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
    /// Контроллер управления документами проекта.
    /// </summary>
    [ApiController]
    [Route("api/projects/{projectId}/documents")]
    [Route("api/v1/projects/{projectId}/documents")]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly IDocumentService _documentService;
        private readonly ILogger<DocumentsController> _logger;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="DocumentsController"/>.
        /// </summary>
        /// <param name="documentService">Сервис документов.</param>
        /// <param name="logger">Логгер.</param>
        public DocumentsController(IDocumentService documentService, ILogger<DocumentsController> logger)
        {
            _documentService = documentService;
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
        /// Получить все версии всех документов проекта (с пагинацией или без).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="page">Номер страницы (опционально).</param>
        /// <param name="pageSize">Размер страницы (опционально).</param>
        /// <param name="type">Тип документа для фильтрации (опционально).</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список документов или страница.</returns>
        [HttpGet]
        public async Task<IActionResult> GetDocuments(
            int projectId,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] string type,
            CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();

                if (page.HasValue && pageSize.HasValue && page.Value > 0 && pageSize.Value > 0)
                {
                    var paged = await _documentService.GetDocumentsPagedAsync(
                        projectId, userId, isAdmin, page.Value, pageSize.Value, type, cancellationToken);
                    return Ok(new { success = true, data = paged });
                }
                else
                {
                    // Старое поведение
                    var docs = await _documentService.GetDocumentsAsync(projectId, userId, isAdmin, cancellationToken);
                    if (!string.IsNullOrEmpty(type))
                    {
                        docs = docs.FindAll(d => d.Type == type);
                    }
                    return Ok(new { success = true, data = docs });
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
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения документов проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Получить активные версии документов (по одной на тип).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список активных документов.</returns>
        [HttpGet("active")]
        public async Task<IActionResult> GetActiveDocuments(int projectId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var docs = await _documentService.GetActiveDocumentsAsync(projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = docs });
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
                _logger.LogError(ex, $"Ошибка получения активных документов проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Получить все версии документа указанного типа.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="type">Тип документа.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список версий.</returns>
        [HttpGet("versions")]
        public async Task<IActionResult> GetDocumentVersions(
            int projectId,
            [FromQuery] string type,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(type))
                    return BadRequest(new { success = false, message = "Тип документа обязателен." });

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var docs = await _documentService.GetDocumentVersionsAsync(
                    projectId, type, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = docs });
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
                _logger.LogError(ex, $"Ошибка получения версий документа типа {type} для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Получить конкретную версию документа.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="documentId">Идентификатор документа.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Документ.</returns>
        [HttpGet("{documentId}")]
        public async Task<IActionResult> GetDocument(int projectId, int documentId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var doc = await _documentService.GetDocumentByIdAsync(
                    documentId, projectId, userId, isAdmin, cancellationToken);
                return Ok(new { success = true, data = doc });
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
                _logger.LogError(ex, $"Ошибка получения документа {documentId} проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Создать новую версию документа (черновик).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="request">Данные нового документа.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Созданный документ.</returns>
        [HttpPost]
        public async Task<IActionResult> CreateDocument(
            int projectId,
            [FromBody] CreateDocumentRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var doc = await _documentService.CreateDocumentAsync(
                    projectId, userId, isAdmin, request.Type, request.Title, request.Content, cancellationToken);
                _logger.LogInformation($"Создана версия документа {doc.Id} (тип {doc.Type}, версия {doc.Version}) для проекта {projectId}");
                return Ok(new { success = true, data = doc });
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
                _logger.LogError(ex, $"Ошибка создания документа для проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Обновить черновик документа (только если не принят).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="documentId">Идентификатор документа.</param>
        /// <param name="request">Данные для обновления.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённый документ.</returns>
        [HttpPost("{documentId}/update")]
        public async Task<IActionResult> UpdateDocument(
            int projectId,
            int documentId,
            [FromBody] UpdateDocumentRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var doc = await _documentService.UpdateDocumentAsync(
                    documentId, projectId, userId, isAdmin, request.Title, request.Content, cancellationToken);
                _logger.LogInformation($"Обновлён документ {documentId} проекта {projectId}");
                return Ok(new { success = true, data = doc });
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
                _logger.LogError(ex, $"Ошибка обновления документа {documentId} проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Принять версию документа (становится активной).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="documentId">Идентификатор документа.</param>
        /// <param name="request">Тело запроса (пустое).</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Принятый документ.</returns>
        [HttpPost("{documentId}/accept")]
        public async Task<IActionResult> AcceptDocument(
            int projectId,
            int documentId,
            [FromBody] AcceptDocumentRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var doc = await _documentService.AcceptDocumentAsync(
                    documentId, projectId, userId, isAdmin, cancellationToken);
                _logger.LogInformation($"Принят документ {documentId} проекта {projectId} пользователем {userId}");
                return Ok(new { success = true, data = doc });
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
                _logger.LogError(ex, $"Ошибка принятия документа {documentId} проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Удалить черновик документа (только если не принят).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="documentId">Идентификатор документа.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат удаления.</returns>
        [HttpPost("{documentId}/delete")]
        public async Task<IActionResult> DeleteDocument(int projectId, int documentId, CancellationToken cancellationToken)
        {
            try
            {
                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                await _documentService.DeleteDocumentAsync(
                    documentId, projectId, userId, isAdmin, cancellationToken);
                _logger.LogInformation($"Удалён документ {documentId} проекта {projectId}");
                return Ok(new { success = true });
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
                _logger.LogError(ex, $"Ошибка удаления документа {documentId} проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }

        /// <summary>
        /// Поиск по документам проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="query">Поисковый запрос.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список найденных документов.</returns>
        [HttpGet("search")]
        public async Task<IActionResult> SearchDocuments(
            int projectId,
            [FromQuery] string query,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                    return BadRequest(new { success = false, message = "Параметр query обязателен." });

                var userId = GetCurrentUserId();
                var isAdmin = IsAdmin();
                var docs = await _documentService.SearchDocumentsAsync(
                    projectId, userId, isAdmin, query, cancellationToken);
                return Ok(new { success = true, data = docs });
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
                _logger.LogError(ex, $"Ошибка поиска документов проекта {projectId}");
                return StatusCode(500, new { success = false, message = "Внутренняя ошибка." });
            }
        }
    }
}