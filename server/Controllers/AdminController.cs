// Controllers/AdminController.cs (дополнения)
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using InfocomChat.Server.Models;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using InfocomChat.Server.Models.Entities;
using InfocomChat.Server.DTOs;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Административный контроллер для управления пользователями, комнатами и модерацией
    /// </summary>
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly UserService _userService;
        private readonly PrivateChatService _privateChatService;
        private readonly ILogger<AdminController> _logger;
        private readonly RoomManager _roomManager;
        private readonly MessageHistoryService _messageHistory;

        // Единственный рабочий конструктор
        public AdminController(
            UserService userService,
            PrivateChatService privateChatService,
            ILogger<AdminController> logger,
            RoomManager roomManager,
            MessageHistoryService messageHistory)
        {
            _userService = userService;
            _privateChatService = privateChatService;
            _logger = logger;
            _roomManager = roomManager;
            _messageHistory = messageHistory;
        }

        // ===== УПРАВЛЕНИЕ РОЛЯМИ =====

        /// <summary>
        /// Получение списка жалоб (админ)
        /// </summary>
        [HttpGet("reports")]
        public async Task<IActionResult> GetReports([FromQuery] bool onlyOpen = true, [FromQuery] int limit = 50)
        {
            try
            {
                var users = await _userService.GetAllUsersAsync();
                // Получение из БД
                return Ok(new { success = true, reports = new List<object>() });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения жалоб");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Разрешить жалобу (админ)
        /// </summary>
        [HttpPost("reports/{reportId}/resolve")]
        public async Task<IActionResult> ResolveReport(string reportId, [FromBody] ResolveReportRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(reportId))
                    return BadRequest(new { error = "ReportId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.ResolverId))
                    return BadRequest(new { error = "ResolverId обязателен" });

                var user = await _userService.GetUserAsync(request.ResolverId);
                // Обновление жалобы в БД
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка разрешения жалобы {reportId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение роли по умолчанию
        /// </summary>
        [HttpGet("default-role")]
        public async Task<IActionResult> GetDefaultRole()
        {
            try
            {
                var role = await _userService.GetDefaultRoleAsync();
                return Ok(new { success = true, defaultRole = role });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения роли по умолчанию");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Установка роли по умолчанию
        /// </summary>
        [HttpPost("default-role")]
        public async Task<IActionResult> SetDefaultRole([FromBody] SetDefaultRoleRequest request)
        {
            try
            {
                // Проверяем, что текущий пользователь — администратор
                // В реальном проекте используйте JWT для проверки
                // Валидация
                if (request == null || string.IsNullOrWhiteSpace(request.Role))
                    return BadRequest(new { error = "Role обязателен" });
                                    
                var result = await _userService.SetDefaultRoleAsync(request.Role);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка установки роли по умолчанию");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение всех пользователей с ролями
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var users = await _userService.GetAllUsersAsync();
                var result = users.Select(u => new
                {
                    UserId = u.Id,
                    u.Name,
                    u.Avatar,
                    u.Color,
                    u.IsOnline,
                    u.Status,
                    u.Role,
                    IsBanned = u.Status == "banned",
                    u.BanReason,
                    u.MutedUntil,
                    u.CreatedAt,
                    u.LastSeen,
                    u.MessageCount,
                    u.RoomCount //= u.UserRooms?.Count ?? 0
                });
                return Ok(new { success = true, users = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения всех пользователей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение пользователей с пагинацией (НОВЫЙ МЕТОД)
        /// </summary>
        [HttpGet("users/paginated")]
        public async Task<IActionResult> GetUsersPaginated([FromQuery] PaginatedRequest request)
        {
            try
            {
                // Валидация параметров пагинации
                if (request == null)
                    request = new PaginatedRequest();

                if (request.Page < 1)
                    request.Page = 1;

                if (request.PageSize < 1 || request.PageSize > 200)
                    request.PageSize = 50;

                var result = await _userService.GetUsersPaginatedAsync(request);

                return Ok(new
                {
                    success = true,
                    data = result.Items.Select(u => new
                    {
                        u.UserId,
                        u.Name,
                        u.Avatar,
                        u.AvatarType,
                        u.AvatarData,
                        u.Color,
                        u.IsOnline,
                        u.Status,
                        u.Role,
                        IsBanned = u.Status == "banned",
                        u.BanReason,
                        u.MutedUntil,
                        u.CreatedAt,
                        u.LastSeen,
                        u.MessageCount,
                        RoomCount = u.UserRooms?.Count ?? 0
                    }),
                    pagination = new
                    {
                        result.TotalCount,
                        result.Page,
                        result.PageSize,
                        result.TotalPages,
                        result.HasPreviousPage,
                        result.HasNextPage
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения пользователей с пагинацией");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Изменение роли пользователя
        /// </summary>
        [HttpPost("user/{userId}/role")]
        public async Task<IActionResult> SetUserRole(string userId, [FromBody] SetRoleRequest request)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.Role))
                    return BadRequest(new { error = "Role обязателен" });

                var result = await _userService.SetUserRoleAsync(
                    userId,
                    request.Role,
                    request.ModeratorId
                );

                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка изменения роли пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение статистики по ролям
        /// </summary>
        [HttpGet("role-stats")]
        public async Task<IActionResult> GetRoleStats()
        {
            try
            {
                var stats = await _userService.GetUserStatsAsync();
                return Ok(new { success = true, stats });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения статистики ролей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === Управление пользователями ===
/*
        [HttpGet("users_old")]
        public async Task<IActionResult> GetAllUsers_old()
        {
            try
            {
                var users = await _privateChatService.GetAllUsers();
                var result = users.Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Avatar,
                    u.Color,
                    u.IsOnline,
                    u.Status,
                    u.IsAdmin,
                    u.IsModerator,
                    IsBanned = u.Status == "banned",
                    u.BanReason,
                    u.MutedUntil,
                    u.CreatedAt,
                    u.LastSeen,
                    u.MessageCount,
                    RoomCount = u.Rooms?.Count ?? 0
                });
                return Ok(new { success = true, users = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
*/

        /// <summary>
        /// Получение онлайн-пользователей
        /// </summary>
        [HttpGet("users/online")]
        public async Task<IActionResult> GetOnlineUsers()
        {
            try
            {
                var users = await _privateChatService.GetOnlineUsersAsync();
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения онлайн-пользователей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение пользователей в комнате
        /// </summary>
        [HttpGet("users/{roomId}")]
        public async Task<IActionResult> GetUsersInRoom(string roomId)
        {
            try
            {
                var users = await _userService.GetUsersInRoomAsync(roomId);
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения пользователей в комнате {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Поиск пользователей
        /// </summary>
        [HttpPost("users/search")]
        public async Task<IActionResult> SearchUsers([FromBody] SearchUsersRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Query))
                    return Ok(new { success = true, users = new List<User>() });

                var users = await _privateChatService.SearchUsersAsync(request.Query);
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка поиска пользователей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        //ВОЗМОЖНО НЕ НАДО, достаем по посту?
        /*
        [HttpGet("users/search")]
        public async Task<IActionResult> SearchUsers([FromBody] SearchUsersRequest request)
        {
            try
            {
                var query = request?.Query;
                var users = await _privateChatService.SearchUsersAsync(query);
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
        */
        
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUser(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });
                
                var user = await _userService.GetUserAsync(userId); // получаем DTO
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                return Ok(new { success = true, user });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение блокировок пользователя
        /// </summary>
        [HttpGet("user/{userId}/blocks")]
        public async Task<IActionResult> GetUserBlocks(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var user = await _privateChatService.GetUserWithBlocksAsync(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                return Ok(new { success = true, user });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения блокировок пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Проверка, является ли пользователь администратором
        /// </summary>
        [HttpGet("user/{userId}/isAdmin")]
        public async Task<IActionResult> GetUserIsAdmin(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _privateChatService.IsAdminAsync(userId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка проверки прав администратора для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Проверка, является ли пользователь модератором
        /// </summary>
        [HttpGet("user/{userId}/isModerator")]
        public async Task<IActionResult> GetUserIsModerator(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _privateChatService.IsModeratorAsync(userId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка проверки прав модератора для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Обновление профиля пользователя
        /// </summary>
        [HttpPut("user/{userId}/profile")]
        public async Task<IActionResult> UpdateUserProfile(string userId, [FromBody] UpdateUserDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null)
                    return BadRequest(new { error = "Пустой запрос" });

                // Получаем сущность пользователя
                var user = await _userService.GetUserAsync(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                // Обновление (используем UserService метод)
                var updated = await _userService.GetOrCreateUserAsync(
                    userId,
                    request.Name ?? user.Name,
                    request.Avatar ?? user.Avatar,
                    request.Color ?? user.Color,
                    request.AvatarType ?? user.AvatarType,
                    request.AvatarData ?? user.AvatarData
                );

                return Ok(new { success = true, user = updated });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления профиля пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение статистики пользователя
        /// </summary>
        [HttpGet("user/{userId}/stats")]
        public async Task<IActionResult> GetUserStats(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var user = await _privateChatService.GetUserAsync(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                var chats = await _privateChatService.GetUserChatsAsync(userId);
                var totalMessages = chats.Sum(c => c.PrivateMessages?.Count ?? 0);

                return Ok(new
                {
                    success = true,
                    stats = new
                    {
                        user.Name,
                        user.MessageCount,
                        totalMessages,
                        chatCount = chats.Count,
                        user.CreatedAt,
                        user.LastSeen,
                        user.IsOnline
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения статистики пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
/*
        [HttpPost("user/{userId}/role_old")]
        public async Task<IActionResult> SetUserRole_old(string userId, [FromBody] SetRoleRequest request)
        {
            try
            {
                var user = await _privateChatService.GetUser(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                if (request.Role == "admin")
                    user.IsAdmin = request.Set;
                else if (request.Role == "moderator")
                    user.IsModerator = request.Set;

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
*/

        // === МОДЕРАЦИЯ ===

        /// <summary>
        /// Заглушить пользователя
        /// </summary>
        [HttpPost("user/{userId}/mute")]
        public async Task<IActionResult> MuteUser(string userId, [FromBody] MuteRequest request)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null || request.Minutes <= 0)
                    return BadRequest(new { error = "Minutes должен быть больше 0" });

                if (string.IsNullOrWhiteSpace(request.ModeratorId))
                    return BadRequest(new { error = "ModeratorId обязателен" });

                var result = await _privateChatService.MuteUserAsync(
                    userId,
                    request.Minutes,
                    request.ModeratorId,
                    request.Reason
                );

                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка мута пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Кикнуть пользователя из комнаты
        /// </summary>
        [HttpPost("user/{userId}/kick")]
        public async Task<IActionResult> KickUser(string userId, [FromBody] KickRequest request)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(request.ModeratorId))
                    return BadRequest(new { error = "ModeratorId обязателен" });

                var result = await _privateChatService.KickUserAsync(
                    userId,
                    request.RoomId,
                    request.ModeratorId
                );

                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка кика пользователя {userId} из комнаты {request?.RoomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Забанить пользователя
        /// </summary>
        [HttpPost("user/{userId}/ban")]
        public async Task<IActionResult> BanUser(string userId, [FromBody] BanRequest request)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.ModeratorId))
                    return BadRequest(new { error = "ModeratorId обязателен" });

                var result = await _privateChatService.BanUserAsync(
                    userId,
                    request.ModeratorId,
                    request.Reason
                );

                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка бана пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Разбанить пользователя
        /// </summary>
        [HttpPost("user/{userId}/unban")]
        public async Task<IActionResult> UnbanUser(string userId, [FromBody] UnbanRequest request)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.ModeratorId))
                    return BadRequest(new { error = "ModeratorId обязателен" });

                var result = await _privateChatService.UnbanUserAsync(
                    userId,
                    request.ModeratorId
                );

                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка разбана пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Очистить историю пользователя (HttpDelete)
        /// </summary>
        [HttpDelete("user/{userId}/history")]
        public async Task<IActionResult> ClearUserHistory_delete(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var chats = await _privateChatService.GetUserChatsAsync(userId);
                foreach (var chat in chats)
                {
                    chat.PrivateMessages?.Clear();
                }
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Очистить историю пользователя
        /// </summary>
        [HttpPost("user/{userId}/history")]
        public async Task<IActionResult> ClearUserHistory(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var chats = await _privateChatService.GetUserChatsAsync(userId);
                foreach (var chat in chats)
                {
                    chat.PrivateMessages?.Clear();
                }
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории пользователя {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }


        /// <summary>
        /// Сбросить счетчик непрочитанных
        /// </summary>
        [HttpPost("user/{userId}/reset-unread")]
        public async Task<IActionResult> ResetUnread(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var user = await _privateChatService.GetUserAsync(userId);
                if (user != null)
                {
                    user.UnreadCount = 0;
                }
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка сброса непрочитанных для {userId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Экспорт всех пользователей в CSV
        /// </summary>
        [HttpGet("users/export")]
        public async Task<IActionResult> ExportUsers()
        {
            try
            {
                var users = await _userService.GetAllUsersAsync();
                var csv = new StringBuilder();
                csv.AppendLine("UserId,Name,Role,Status,IsOnline,CreatedAt,LastSeen,MessageCount");

                foreach (var u in users)
                {
                    csv.AppendLine($"{u.Id},{u.Name},{u.Role},{u.Status},{u.IsOnline},{u.CreatedAt:yyyy-MM-dd},{u.LastSeen:yyyy-MM-dd HH:mm},{u.MessageCount}");
                }

                return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv", $"users_export_{DateTime.Now:yyyyMMdd}.csv");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка экспорта пользователей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Импорт пользователей из CSV (заглушка)
        /// </summary>
        [HttpPost("users/import")]
        public async Task<IActionResult> ImportUsers([FromBody] object data)
        {
            try
            {
                var users = await _userService.GetAllUsersAsync();
                // Заглушка, требует реализации парсинга CSV
                return Ok(new { success = true, message = "Импорт пользователей пока не реализован" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка импорта пользователей");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === УПРАВЛЕНИЕ КОМНАТАМИ ===

        /// <summary>
        /// Получение списка всех комнат
        /// </summary>
        [HttpGet("rooms")]
        public async Task<IActionResult> GetRooms()
        {
            try
            {
                var rooms = await _roomManager.GetActiveRoomsAsync();
                var result = rooms.Select(r => new
                {
                    r.RoomId,
                    r.Name,
                    r.CreatedAt,
                    r.MessageCount,
                    UserCount = r.Users?.Count ?? 0,
                    r.LastActivity,
                    IsActive = r.Users?.Any() ?? false
                });
                return Ok(new { success = true, rooms = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения списка комнат");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение информации о комнате
        /// </summary>
        [HttpGet("room/{roomId}")]
        public async Task<IActionResult> GetRoom(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

                return Ok(new { success = true, room });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения информации о комнате {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение статистики комнаты
        /// </summary>
        [HttpGet("room/{roomId}/stats")]
        public async Task<IActionResult> GetRoomStats(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

                var stats = await _roomManager.GetMessageStatsAsync(roomId);

                return Ok(new
                {
                    success = true,
                    stats = new
                    {
                        room.Name,
                        room.MessageCount,
                        UserCount = room.Users?.Count ?? 0,
                        stats.UserMessages,
                        stats.AssistantMessages,
                        stats.EditedMessages,
                        stats.FirstMessageTime,
                        stats.LastMessageTime,
                        room.CreatedAt,
                        room.LastActivity
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения статистики комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Удаление комнаты (HttpDelete)
        /// </summary>
        [HttpDelete("room/{roomId}")]
        public async Task<IActionResult> DeleteRoom_delete(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.DeleteRoomAsync(roomId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Удаление комнаты (Post)
        /// </summary>
        [HttpPost("room/{roomId}")]
        public async Task<IActionResult> DeleteRoom(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.DeleteRoomAsync(roomId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        /// <summary>
        /// Очистка истории комнаты  (HttpDelete)
        /// </summary>
        [HttpDelete("room/{roomId}/history")]
        public async Task<IActionResult> ClearRoomHistory_delete(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.ClearRoomHistoryAsync(roomId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Очистка истории комнаты
        /// </summary>
        [HttpPost("room/{roomId}/history")]
        public async Task<IActionResult> ClearRoomHistory(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.ClearRoomHistoryAsync(roomId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Закрытие комнаты
        /// </summary>
        [HttpPost("room/{roomId}/close")]
        public async Task<IActionResult> CloseRoom(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room != null && room.Settings != null)
                {
                    // Помечаем комнату как закрытую (используем поле IsPrivate как флаг закрытия)
                    // В реальном проекте нужно добавить отдельное поле IsClosed

                    // Помечаем комнату как закрытую через настройки
                    room.Settings = room.Settings ?? new RoomSettings();
                    // Устанавливаем время жизни в 0 для закрытия
                    room.Settings.LifetimeMinutes = 0;
                    await _roomManager.UpdateRoomSettingsAsync(roomId, room.Settings);
                }
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка закрытия комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Обновление настроек комнаты (админ)
        /// </summary>
        [HttpPut("room/{roomId}/settings")]
        public async Task<IActionResult> UpdateRoomSettings(string roomId, [FromBody] RoomSettings settings)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (settings == null)
                    return BadRequest(new { error = "Пустой запрос" });

                var result = await _roomManager.UpdateRoomSettingsAsync(roomId, settings);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления настроек комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Передача владения комнатой
        /// </summary>
        [HttpPost("room/{roomId}/transfer")]
        public async Task<IActionResult> TransferRoomOwnership(string roomId, [FromBody] TransferOwnershipRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.NewOwnerId))
                    return BadRequest(new { error = "NewOwnerId обязателен" });

                // Получаем информацию о комнате
                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

                // Проверяем, что пользователь существует
                var newOwner = await _userService.GetUserAsync(request.NewOwnerId);
                if (newOwner == null)
                    return BadRequest(new { error = "Новый владелец не найден" });

                // Обновляем владельца (здесь нужно реализовать логику в RoomManager)
                // Заглушка
                return Ok(new { success = true, message = "Передача владения пока не реализована" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка передачи владения комнатой {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === Экспорт ===

        /// <summary>
        /// Экспорт комнаты (исправленная версия, без dynamic)
        /// </summary>
        /// [Obsolete("This method is deprecated. Use ExportRoomV2 for improved format.")]
        [HttpGet("room/{roomId}/export")]
        public async Task<IActionResult> ExportRoom(string roomId, [FromQuery] string format = "json")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var room = await _roomManager.GetRoomInfoAsync(roomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

/*
                var mess = room.Messages?.Select(m => new
                {
                    m.Id,
                    m.UserName,
                    m.Content,
                    m.Timestamp,
                    m.Role
                }).ToList();
*/

                // Получаем сообщения с явным типом
                var messages = room.Messages?
                    .Select(m => new
                    {
                        m.Id,
                        m.UserName,
                        m.Content,
                        m.Timestamp,
                        m.Role
                    })
                    .ToList();

                var data = new
                {
                    room.RoomId,
                    room.Name,
                    room.CreatedAt,
                    room.LastActivity,
                    Messages = new List<object>()
                    //Messages = messages
                };

                //Есть глюки
                var data1 = new
                {
                    room.RoomId,
                    room.Name,
                    room.CreatedAt,
                    room.LastActivity,
                    Messages = messages
                };

                if(messages == null)
                { 
                    if (format?.ToLower() == "json")
                    {
                        return Ok(new { success = true, data });
                    }

                    // Для других форматов можно расширить
                    return Ok(new { success = true, data });
                }
                else
                {
                    if (format?.ToLower() == "json")
                    {
                        return Ok(new { success = true, data1 });
                    }

                    // Для других форматов можно расширить
                    return Ok(new { success = true, data1 });
                }
                /*
                if (format?.ToLower() == "json")
                {
                    if (mess == null)
                    {
                        return Ok(new { success = true, data });
                    }
                    else
                    {
                        return Ok(new { success = true, data1 });
                    }
                }

                if (mess == null)
                {
                    return Ok(new { success = true, data });
                }
                else
                {
                    return Ok(new { success = true, data1 });
                }
                */
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка экспорта комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("room/{roomId}/export/v2")]
        public async Task<IActionResult> ExportRoomV2(string roomId, [FromQuery] string format = "json")
        {
            if (string.IsNullOrWhiteSpace(roomId))
                return BadRequest(new { error = "RoomId обязателен" });

            var room = await _roomManager.GetRoomInfoAsync(roomId);
            if (room == null)
                return NotFound(new { error = "Комната не найдена" });
            var data = new
            {
                room.RoomId,
                room.Name,
                room.CreatedAt,
                room.LastActivity,
                Messages = new List<object>()
                //Messages = messages
            };
            // Для других форматов можно расширить
            return Ok(new { success = true, data });
        }

        // === Управление сообщениями === 

        /// <summary>
        /// Удаление сообщения (HttpDelete)
        /// </summary>
        [HttpDelete("message/{messageId}")]
        public async Task<IActionResult> DeleteMessage(string messageId)
        {
            try
            {
                // Поиск и удаление сообщения
                var deleted = false;
                var rooms = await _roomManager.GetActiveRoomsAsync();
                foreach (var room in rooms)
                {
                    var msg = room.Messages?.FirstOrDefault(m => m.Id == messageId);
                    if (msg != null)
                    {
                        room.Messages.Remove(msg);
                        deleted = true;
                        break;
                    }
                }

                if (!deleted)
                {
                    // Ищем в приватных чатах
                    var chats = await _privateChatService.GetAllUsersAsync();
                    // В реальном проекте нужен более эффективный поиск
                }

                return Ok(new { success = deleted });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Удаление сообщения
        /// </summary>
        [HttpPost("message/{messageId}")]
        public async Task<IActionResult> EditMessage(string messageId, [FromBody] AdminEditMessageRequest request)
        {
            try
            {
                //var result = false;

                // Валидация
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.ModeratorId))
                    return BadRequest(new { error = "ModeratorId обязателен" });

                var result = await _privateChatService.EditPrivateMessageAsync(
                    messageId,
                    request.ModeratorId,
                    request.NewContent
                );

                // Аналогичный поиск и редактирование
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("messages/search")]
        public async Task<IActionResult> SearchMessages([FromBody] SearchMessagesRequest request)
        {
            try
            {
                var results = new List<object>();
                var rooms = await _roomManager.GetActiveRoomsAsync();

                foreach (var room in rooms)
                {
                    var mess = room.Messages?
                        .Where(m => m.Content?.Contains(request.Query, StringComparison.OrdinalIgnoreCase) == true)
                        .Take(100)
                        .Select(m => new
                        {
                            m.Id,
                            m.Content,
                            m.UserName,
                            m.Timestamp,
                            RoomId = room.RoomId,
                            RoomName = room.Name
                        })
                        .ToList();
                    var messages = mess;//?.Count() ? mess : new List<object>();
                    if (messages != null)
                    {
                        results.AddRange(messages);
                    }
                    else
                    {
                        results.AddRange(new List<object>());
                    }
                }

                return Ok(new
                {
                    success = true,
                    results = results.OrderByDescending(r => ((dynamic)r).Timestamp).Take(request.Limit)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === СТАТИСТИКА ===

        /// <summary>
        /// Получение общей статистики
        /// </summary>
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            try
            {
                var stats = await _privateChatService.GetStatsAsync();
                return Ok(new { success = true, stats });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения статистики");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение логов модерации
        /// </summary>
        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs([FromQuery] string userId = null)
        {
            try
            {
                var logs = await _privateChatService.GetModerationLogAsync(userId);
                return Ok(new { success = true, logs });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения логов");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Очистка всех данных (опасно!)  (HttpDelete)
        /// </summary>
        [HttpDelete("clear-all")]
        public async Task<IActionResult> ClearAll_delete()
        {
            try
            {
                var result = await _privateChatService.ClearAllData();
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка очистки всех данных");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Очистка всех данных (опасно!)
        /// </summary>
        [HttpPost("clear-all")]
        public async Task<IActionResult> ClearAll()
        {
            try
            {
                var result = await _privateChatService.ClearAllData();
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка очистки всех данных");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Health check
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                version = "5.1.0"
            });
        }
    }

    // === DTO ===

    /// <summary>
    /// Запрос установки роли по умолчанию // Admin, Manager, User, Guest
    /// </summary>
    public class SetDefaultRoleRequest
    {
        [Required(ErrorMessage = "Role обязателен")]        
        public string Role { get; set; }  // Admin, Manager, User, Guest
    }

    /// <summary>
    /// Запрос установки роли пользователя // Admin, Manager, User, Guest
    /// </summary>
    public class SetRoleRequest
    {
        [Required(ErrorMessage = "Role обязателен")]        
        public string Role { get; set; } // Admin, Manager, User, Guest
        public string ModeratorId { get; set; }
        public bool Set { get; set; }
    }

    /*
    public class SetRoleRequest
    {
        public string Role { get; set; } // admin, moderator
        public bool Set { get; set; }
    }
    */

    /// <summary>
    /// Запрос на мут пользователя
    /// </summary>    
    public class MuteRequest
    {
        [Range(1, 1440, ErrorMessage = "Minutes должен быть от 1 до 1440")]
        public int Minutes { get; set; }

        [Required(ErrorMessage = "ModeratorId обязателен")]
        public string ModeratorId { get; set; }
        public string Reason { get; set; }
    }

    /// <summary>
    /// Запрос на кик пользователя
    /// </summary>
    public class KickRequest
    {
        [Required(ErrorMessage = "RoomId обязателен")]
        public string RoomId { get; set; }

        [Required(ErrorMessage = "ModeratorId обязателен")]
        public string ModeratorId { get; set; }
    }

    /// <summary>
    /// Запрос на бан пользователя
    /// </summary>
    public class BanRequest
    {
        [Required(ErrorMessage = "ModeratorId обязателен")]
        public string ModeratorId { get; set; }
        public string Reason { get; set; }
    }

    /// <summary>
    /// Запрос на разбан пользователя
    /// </summary>
    public class UnbanRequest
    {
        [Required(ErrorMessage = "ModeratorId обязателен")]
        public string ModeratorId { get; set; }
    }

    /// <summary>
    /// Запрос на редактирование сообщения (админ)
    /// </summary>
    public class AdminEditMessageRequest
    {
        [Required(ErrorMessage = "NewContent обязателен")]
        [MaxLength(10000, ErrorMessage = "Сообщение не может быть длиннее 10000 символов")]
        public string NewContent { get; set; }

        [Required(ErrorMessage = "ModeratorId обязателен")]
        public string ModeratorId { get; set; }
    }

    /// <summary>
    /// Запрос поиска сообщений
    /// </summary>
    public class SearchMessagesRequest
    {
        [Required(AllowEmptyStrings = true, ErrorMessage = "Query обязателен")]
        [MaxLength(500, ErrorMessage = "Query не может быть длиннее 500 символов")]
        public string Query { get; set; }
        public string RoomId { get; set; }

        [Range(1, 200, ErrorMessage = "Limit должен быть от 1 до 200")]
        public int Limit { get; set; } = 50;
    }

    /// <summary>
    /// Запрос поиска пользователей
    /// </summary>
    public class SearchUsersRequest
    {
        [MaxLength(100, ErrorMessage = "Query не может быть длиннее 100 символов")]
        public string Query { get; set; }
    }
}

/// <summary>
/// DTO для передачи владения
/// </summary>
public class TransferOwnershipRequest
{
    public string NewOwnerId { get; set; }
}

public class ResolveReportRequest
{
    public string ResolverId { get; set; }
    public string ResolutionNote { get; set; }
}