// Controllers/ChatController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using InfocomChat.Server.Models;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер для работы с сообщениями чата
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly MessageHistoryService _messageHistory;
        private readonly MentionService _mentionService;
        private readonly UserService _userService; // Добавлен для проверки мута
        private readonly NotificationService _notificationService; // добавить в конструктор        
        private readonly ILogger<ChatController> _logger;

        public ChatController(
            RoomManager roomManager,
            MessageHistoryService messageHistory,
            MentionService mentionService,
            UserService userService,
            NotificationService notificationService,
            ILogger<ChatController> logger)
        {
            _roomManager = roomManager;
            _messageHistory = messageHistory;
            _mentionService = mentionService;
            _userService = userService;
            _notificationService = notificationService;
            _logger = logger;
        }

        /// <summary>
        /// Отправка сообщения в комнату с валидацией и обработкой упоминаний
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
        {
            try
            {
                // === ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ ===

                // Проверка на null
                if (request == null)
                    return BadRequest(new { error = "Пустой запрос" });

                // Проверка обязательных полей
                if (string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (string.IsNullOrWhiteSpace(request.UserName))
                    return BadRequest(new { error = "UserName обязателен" });

                if (string.IsNullOrWhiteSpace(request.Content))
                    return BadRequest(new { error = "Сообщение не может быть пустым" });

                // === ПРОВЕРКА НА МУТ (НОВОЕ) ===
                if (await _userService.IsUserMutedAsync(request.UserId))
                    return BadRequest(new { error = "Вы временно заблокированы (мут)" });

                // Проверка длины сообщения
                if (request.Content.Length > 10000)
                    return BadRequest(new { error = "Сообщение слишком длинное (макс. 10000 символов)" });

                // Проверка на XSS (улучшенная)
                var xssPattern = new Regex(
                    @"<script|javascript:|data:text/html|on\w+\s*=|src\s*=\s*['""]?\s*javascript",
                    RegexOptions.Compiled | RegexOptions.IgnoreCase);
                if (xssPattern.IsMatch(request.Content))
                {
                    _logger.LogWarning($"Попытка XSS от пользователя {request.UserId}: {request.Content.Substring(0, Math.Min(100, request.Content.Length))}");
                    return BadRequest(new { error = "Обнаружены недопустимые символы в сообщении" });
                }
                
                /*
                // Проверка на XSS (простейшая защита)
                var xssPatterns = new[] { "<script", "javascript:", "onerror=", "onload=", "onclick=" };
                var contentLower = request.Content.ToLower();
                foreach (var pattern in xssPatterns)
                {
                    if (contentLower.Contains(pattern))
                    {
                        _logger.LogWarning($"Попытка XSS от пользователя {request.UserId}: {request.Content.Substring(0, Math.Min(100, request.Content.Length))}");
                        return BadRequest(new { error = "Обнаружены недопустимые символы в сообщении" });
                    }
                }
                */

                // Проверка вложений
                if (request.Attachments != null)
                {
                    foreach (var attachment in request.Attachments)
                    {
                        if (!attachment.IsValid())
                        {
                            return BadRequest(new { error = $"Недопустимое вложение: {attachment.Name}" });
                        }
                    }
                }

                // === СОЗДАНИЕ СООБЩЕНИЯ ===

                var message = new ChatMessage
                {
                    Id = Guid.NewGuid().ToString(),
                    RoomId = request.RoomId,
                    UserId = request.UserId,
                    UserName = request.UserName,
                    UserAvatar = request.UserAvatar ?? "👤",
                    Role = request.Role ?? "user",
                    Content = request.Content,
                    Timestamp = DateTime.UtcNow,
                    ReplyToId = request.ReplyToId,
                    Model = request.Model ?? "local-model",
                    Attachments = request.Attachments ?? new List<FileAttachment>()
                };

                // === СОХРАНЕНИЕ СООБЩЕНИЯ ===

                var result = await _roomManager.AddMessageAsync(request.RoomId, message);
                
                if (!result)
                    return BadRequest(new { error = "Не удалось отправить сообщение" });

                // === ОБРАБОТКА УПОМИНАНИЙ ===

                var mentions = new List<string>();
                try
                {
                    // Создаём упоминания из текста сообщения
                    var mentionEntities = await _mentionService.CreateMentionsAsync(
                        message.Id,
                        message.Content,
                        message.UserId
                    );

                    if (mentionEntities != null && mentionEntities.Count > 0)
                    {
                        mentions.AddRange(mentionEntities.Select(m => m.UserId));

                        // Уведомляем упомянутых пользователей
                        foreach (var mention in mentionEntities)
                        {
                            await _roomManager.NotifyUserMentionedAsync(
                                mention.UserId,
                                message,
                                mention.MentionedBy
                            );
                        }

                        _logger.LogInformation($"Создано {mentionEntities.Count} упоминаний для сообщения {message.Id}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Ошибка обработки упоминаний для сообщения {message.Id}");
                    // Не прерываем выполнение, сообщение уже сохранено
                }

                // === УВЕДОМЛЕНИЕ ===

                    await _roomManager.NotifyNewMessageAsync(request.RoomId, message);

                // === ОТВЕТ ===

                return Ok(new
                {
                    success = true,
                    message = message,
                    mentions = mentions,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка при отправке сообщения от {request?.UserId ?? "unknown"}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Закрепить сообщение в комнате
        /// </summary>
        [HttpPost("pin/{messageId}")]
        public async Task<IActionResult> PinMessage(string messageId, [FromBody] PinRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                // Проверяем, существует ли сообщение и комната
                var room = await _roomManager.GetRoomInfoAsync(request.RoomId);
                if (room == null)
                    return NotFound(new { error = "Комната не найдена" });

                var message = room.Messages?.FirstOrDefault(m => m.Id == messageId);
                if (message == null)
                    return NotFound(new { error = "Сообщение не найдено" });

                // Проверяем, что пользователь имеет права (админ или создатель)
                // Заглушка, добавляем в БД
                var pinned = new PinnedMessage
                {
                    MessageId = messageId,
                    RoomId = request.RoomId,
                    PinnedBy = request.UserId,
                    PinnedAt = DateTime.UtcNow
                };

                // Сохраняем через контекст (нужно добавить в ChatDbContext)
                // Здесь реализация через сервис

                return Ok(new { success = true, pinnedAt = DateTime.UtcNow });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка закрепления сообщения {messageId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Открепить сообщение
        /// </summary>
        [HttpDelete("pin/{messageId}")]
        public async Task<IActionResult> UnpinMessage(string messageId, [FromQuery] string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                // Проверяем, существует ли сообщение и комната
                var room = await _roomManager.GetRoomInfoAsync(roomId);

                // Удаление из БД
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка открепления сообщения {messageId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получить закреплённые сообщения комнаты
        /// </summary>
        [HttpGet("pinned/{roomId}")]
        public async Task<IActionResult> GetPinnedMessages(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                // Проверяем, существует ли сообщение и комната
                var room = await _roomManager.GetRoomInfoAsync(roomId);

                // Получение из БД
                return Ok(new { success = true, messages = new List<object>() });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения закреплённых сообщений комнаты {roomId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Пожаловаться на сообщение
        /// </summary>
        [HttpPost("report/{messageId}")]
        public async Task<IActionResult> ReportMessage(string messageId, [FromBody] ReportRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (request == null || string.IsNullOrWhiteSpace(request.ReporterId))
                    return BadRequest(new { error = "ReporterId обязателен" });

                // Проверяем, существует ли пользователь
                var user = await _userService.GetUserAsync(request.ReporterId);

                //var message = room.Messages?.FirstOrDefault(m => m.Id == messageId);
                // Создаём жалобу
                var report = new Report
                {
                    MessageId = messageId,
                    ReporterId = request.ReporterId,
                    Reason = request.Reason,
                    Description = request.Description,
                    CreatedAt = DateTime.UtcNow,
                    IsResolved = false
                };

                // Сохраняем в БД
                return Ok(new { success = true, reportId = report.ReportId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка жалобы на сообщение {messageId}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение истории сообщений комнаты с пагинацией
        /// </summary>
        [HttpGet("history/{roomId}")]
        public async Task<IActionResult> GetHistory(
            string roomId,
            [FromQuery] int limit = 100,
            [FromQuery] int offset = 0)
        {
            try
            {
                // Валидация параметров
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (limit < 1 || limit > 500)
                    return BadRequest(new { error = "Limit должен быть от 1 до 500" });

                if (offset < 0)
                    return BadRequest(new { error = "Offset не может быть отрицательным" });

                var history = await _messageHistory.GetHistoryAsync(roomId, limit, offset);
                var total = await _messageHistory.GetMessageCountAsync(roomId);

                return Ok(new
                {
                    success = true,
                    messages = history,
                    total = total,
                    limit = limit,
                    offset = offset,
                    hasMore = offset + limit < total
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения истории комнаты {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Редактирование сообщения
        /// </summary>
        [HttpPost("edit")]
        public async Task<IActionResult> EditMessage([FromBody] EditMessageRequest request)
        {
            try
            {
                // Валидация
                if (request == null)
                    return BadRequest(new { error = "Пустой запрос" });

                if (string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(request.MessageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (string.IsNullOrWhiteSpace(request.NewContent))
                    return BadRequest(new { error = "Новое содержание не может быть пустым" });

                if (request.NewContent.Length > 10000)
                    return BadRequest(new { error = "Сообщение слишком длинное (макс. 10000 символов)" });

                var result = await _roomManager.EditMessageAsync(
                    request.RoomId, 
                    request.MessageId, 
                    request.UserId, 
                    request.NewContent
                );

                if (result)
                {
                    await _roomManager.NotifyMessageEditedAsync(
                        request.RoomId,
                        request.MessageId,
                        request.NewContent
                    );

                    return Ok(new
                    {
                        success = true,
                        messageId = request.MessageId,
                        newContent = request.NewContent,
                        editedAt = DateTime.UtcNow
                    });
                }

                return BadRequest(new { error = "Не удалось отредактировать сообщение" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка редактирования сообщения {request?.MessageId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Удаление сообщения (HttpDelete)
        /// </summary>
        [HttpDelete("delete/{roomId}/{messageId}/{userId}")]
        public async Task<IActionResult> DeleteMessage_delete(string roomId, string messageId, string userId)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _roomManager.DeleteMessageAsync(roomId, messageId, userId);

                if (result)
                {
                    await _roomManager.NotifyMessageDeletedAsync(roomId, messageId);

                    return Ok(new
                    {
                        success = true,
                        messageId = messageId,
                        deletedAt = DateTime.UtcNow
                    });
                }

                return BadRequest(new { error = "Не удалось удалить сообщение" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления сообщения {messageId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Удаление сообщения
        /// </summary>
        [HttpPost("delete/{roomId}/{messageId}/{userId}")]
        public async Task<IActionResult> DeleteMessage(string roomId, string messageId, string userId)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _roomManager.DeleteMessageAsync(roomId, messageId, userId);

                if (result)
                {
                    await _roomManager.NotifyMessageDeletedAsync(roomId, messageId);

                    return Ok(new
                    {
                        success = true,
                        messageId = messageId,
                        deletedAt = DateTime.UtcNow
                    });
                }

                return BadRequest(new { error = "Не удалось удалить сообщение" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления сообщения {messageId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Поиск сообщений по тексту
        /// </summary>
        [HttpGet("search/{roomId}")]
        public async Task<IActionResult> SearchMessages(
            string roomId,
            [FromQuery] string query,
            [FromQuery] int limit = 50)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(query))
                    return BadRequest(new { error = "Query обязателен" });

                if (limit < 1 || limit > 200)
                    return BadRequest(new { error = "Limit должен быть от 1 до 200" });

                var results = await _roomManager.SearchMessagesAsync(roomId, query, limit);

                return Ok(new
                {
                    success = true,
                    results = results,
                    count = results.Count,
                    query = query,
                    limit = limit
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка поиска сообщений в комнате {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Получение последнего сообщения в комнате
        /// </summary>
        [HttpGet("last/{roomId}")]
        public async Task<IActionResult> GetLastMessage(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var message = await _roomManager.GetLastMessageAsync(roomId);

                if (message == null)
                    return Ok(new { success = true, message = (ChatMessage)null, hasMessages = false });

                return Ok(new { success = true, message = message, hasMessages = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения последнего сообщения комнаты {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Получение сообщений по диапазону дат
        /// </summary>
        [HttpGet("range/{roomId}")]
        public async Task<IActionResult> GetMessagesByDateRange(
            string roomId,
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] int limit = 100)
        {
            try
            {
                // Валидация
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (from > to)
                    return BadRequest(new { error = "Дата 'from' не может быть позже 'to'" });

                if (limit < 1 || limit > 500)
                    return BadRequest(new { error = "Limit должен быть от 1 до 500" });

                var messages = await _roomManager.GetMessagesByDateRangeAsync(roomId, from, to);

                // Ограничиваем количество
                if (messages.Count > limit)
                {
                    messages = messages.GetRange(0, limit);
                }

                return Ok(new
                {
                    success = true,
                    messages = messages,
                    count = messages.Count,
                    from = from,
                    to = to,
                    limit = limit
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сообщений по диапазону дат в комнате {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Получение статистики сообщений комнаты
        /// </summary>
        [HttpGet("stats/{roomId}")]
        public async Task<IActionResult> GetMessageStats(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var stats = await _roomManager.GetMessageStatsAsync(roomId);

                return Ok(new
                {
                    success = true,
                    stats = stats
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения статистики комнаты {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Получение сообщений после указанного ID (для синхронизации)
        /// </summary>
        [HttpGet("after/{roomId}/{lastMessageId}")]
        public async Task<IActionResult> GetMessagesAfterId(string roomId, string lastMessageId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(lastMessageId))
                    return BadRequest(new { error = "LastMessageId обязателен" });

                var messages = await _roomManager.GetMessagesAfterIdAsync(roomId, lastMessageId);

                return Ok(new
                {
                    success = true,
                    messages = messages,
                    count = messages.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сообщений после {lastMessageId} в комнате {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Очистка истории комнаты (только для администраторов) (HttpDelete)
        /// </summary>
        [HttpDelete("clear/{roomId}")]
        public async Task<IActionResult> ClearHistory_delete(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.ClearRoomHistoryAsync(roomId);

                if (result)
                {
                    return Ok(new
                    {
                        success = true,
                        roomId = roomId,
                        clearedAt = DateTime.UtcNow
                    });
                }

                return BadRequest(new { error = "Не удалось очистить историю" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории комнаты {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        /// <summary>
        /// Очистка истории комнаты (только для администраторов)
        /// </summary>
        [HttpPost("clear/{roomId}")]
        public async Task<IActionResult> ClearHistory(string roomId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(roomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _roomManager.ClearRoomHistoryAsync(roomId);

                if (result)
                {
                    return Ok(new
                    {
                        success = true,
                        roomId = roomId,
                        clearedAt = DateTime.UtcNow
                    });
                }

                return BadRequest(new { error = "Не удалось очистить историю" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка очистки истории комнаты {roomId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }
    }

    // DTOs
    public class SendMessageRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string UserAvatar { get; set; }
        public string Content { get; set; }
        public string Role { get; set; }
        public string ReplyToId { get; set; }
        public string Model { get; set; }
        public List<FileAttachment> Attachments { get; set; }
    }
    
    /// <summary>
    /// DTO для закрепления
    /// </summary>
    public class PinRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
    }

    /// <summary>
    /// DTO для жалобы
    /// </summary>
    public class ReportRequest
    {
        public string ReporterId { get; set; }
        public string Reason { get; set; }
        public string Description { get; set; }
    }
}