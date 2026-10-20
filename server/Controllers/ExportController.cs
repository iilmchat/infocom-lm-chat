// Controllers/ExportController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер экспорта данных
    /// </summary>
    [ApiController]
    [Route("api/export")]
    public class ExportController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly UserService _userService;
        private readonly ILogger<ExportController> _logger;

        public ExportController(RoomManager roomManager, UserService userService, ILogger<ExportController> logger)
        {
            _roomManager = roomManager;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Экспорт комнаты в PDF (заглушка)
        /// </summary>
        [HttpGet("room/{roomId}/pdf")]
        public async Task<IActionResult> ExportRoomPdf(string roomId)
        {
            try
            {
                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

                // Здесь должна быть генерация PDF, но для примера вернём JSON
                return Ok(new
                {
                    success = true,
                    message = "PDF экспорт пока не реализован, используйте /export/room/{roomId}?format=json",
                    data = room
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка экспорта комнаты {roomId} в PDF");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Экспорт всех данных пользователя (GDPR)
        /// </summary>
        [HttpGet("user/{userId}/data")]
        public async Task<IActionResult> ExportUserData(string userId)
        {
            try
            {
                var user = await _userService.GetUserAsync(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                // Собираем все данные пользователя
                var data = new
                {
                    User = user,
                    // Здесь можно добавить сообщения, чаты и т.д.
                };

                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                return File(Encoding.UTF8.GetBytes(json), "application/json", $"user_{userId}_data.json");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка экспорта данных пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Импорт комнаты из JSON (админ)
        /// </summary>
        [HttpPost("import/room")]
        public async Task<IActionResult> ImportRoom([FromBody] object roomData)
        {
            try
            {
                var roomId = roomData as string;
                var room = await _roomManager.GetRoomInfoAsync(roomId);
                // Заглушка для импорта
                return Ok(new
                {
                    success = true,
                    message = "Импорт комнаты пока не реализован"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка импорта комнаты");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}