// Controllers/RoomController.cs

using System;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using InfocomChat.Server.Models;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RoomController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly ILogger<ChatController> _logger;

        public RoomController(RoomManager roomManager,
            ILogger<ChatController> logger)
        {
            _roomManager = roomManager;
            _logger = logger;
        }

        /// <summary>
        /// Создание комнаты
        /// </summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreateRoom([FromBody] CreateRoomRequest request)
        {
            try
            {
                var roomId = await _roomManager.CreateRoomAsync(request.Name, request.CreatedBy);
                return Ok(new { success = true, roomId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Поиск комнат по названию/описанию
        /// </summary>
        [HttpGet("search")]
        public async Task<IActionResult> SearchRooms([FromQuery] string query, [FromQuery] int limit = 20)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                    return Ok(new { success = true, rooms = new List<RoomInfo>() });

                var allRooms = await _roomManager.GetActiveRoomsAsync();
                var filtered = allRooms
                    .Where(r => r.Name.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                                (r.Description != null && r.Description.Contains(query, StringComparison.OrdinalIgnoreCase)))
                    .Take(limit)
                    .ToList();

                return Ok(new { success = true, rooms = filtered });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка поиска комнат");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Вход в комнату
        /// </summary>
        [HttpPost("join")]
        public async Task<IActionResult> JoinRoom([FromBody] JoinRoomRequest request)
        {
            try
            {
                var result = await _roomManager.AddUserToRoomAsync(request.RoomId, request.User);
                
                if (result)
                {
                    // Получаем историю для нового пользователя
                    var history = await _roomManager.GetRoomHistoryAsync(request.RoomId, 100);
                    
                    // Уведомляем других пользователей
                    await _roomManager.NotifyUserJoinedAsync(request.RoomId, request.User);
                    
                    return Ok(new { 
                        success = true, 
                        users = await _roomManager.GetRoomUsersAsync(request.RoomId),
                        history
                    });
                }

                return BadRequest(new { error = "Не удалось войти в комнату" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Выход из комнаты
        /// </summary>
        [HttpPost("leave")]
        public async Task<IActionResult> LeaveRoom([FromBody] LeaveRoomRequest request)
        {
            try
            {
                var result = await _roomManager.RemoveUserFromRoomAsync(request.RoomId, request.UserId);
                
                if (result)
                {
                    await _roomManager.NotifyUserLeftAsync(request.RoomId, request.UserId);
                    return Ok(new { success = true });
                }

                return BadRequest(new { error = "Не удалось выйти из комнаты" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение списка комнат
        /// </summary>
        [HttpGet("list")]
        public async Task<IActionResult> GetRooms()
        {
            try
            {
                var rooms = await _roomManager.GetActiveRoomsAsync();
                return Ok(new { success = true, rooms });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение информации о комнате
        /// </summary>
        [HttpGet("info/{roomId}")]
        public async Task<IActionResult> GetRoomInfo(string roomId)
        {
            try
            {
                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room != null)
                {
                    return Ok(new { success = true, room });
                }
                return NotFound(new { error = "Комната не найдена" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class CreateRoomRequest
    {
        public string Name { get; set; }
        public string CreatedBy { get; set; }
    }

    public class JoinRoomRequest
    {
        public string RoomId { get; set; }
        public UserInfo User { get; set; }
    }

    public class LeaveRoomRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
    }
}