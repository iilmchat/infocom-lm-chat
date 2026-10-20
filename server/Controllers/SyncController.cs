// Controllers/SyncController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using InfocomChat.Server.Models;
using InfocomChat.Server.DTOs;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер синхронизации через Long Polling
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SyncController : ControllerBase
    {
        private readonly RoomManager _roomManager;
        private readonly UserPresenceService _presenceService;
        private readonly MessageHistoryService _messageHistory;

        // Хранилище для ожидающих запросов (Long Polling)
        private static readonly Dictionary<string, List<PendingPollRequest>> _pendingPolls = new Dictionary<string, List<PendingPollRequest>>();

        public SyncController(
            RoomManager roomManager,
            UserPresenceService presenceService,
            MessageHistoryService messageHistory)
        {
            _roomManager = roomManager;
            _presenceService = presenceService;
            _messageHistory = messageHistory;
        }

        /// <summary>
        /// Получение текущего состояния для синхронизации
        /// Используется для Long Polling - клиент запрашивает состояние и ждет изменений
        /// </summary>
        [HttpPost("state")]
        public async Task<IActionResult> GetState([FromBody] SyncStateRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RoomId) || string.IsNullOrEmpty(request.UserId))
                {
                    return BadRequest(new { error = "RoomId и UserId обязательны" });
                }

                var state = new SyncStateResponse
                {
                    RoomId = request.RoomId,
                    Timestamp = DateTime.UtcNow,
                    Users = new List<UserInfo>(),
                    NewMessages = new List<ChatMessage>(),
                    HasChanges = false
                };

                // Получаем информацию о комнате
                var room = await _roomManager.GetRoomInfoAsync(request.RoomId);
                if (room != null)
                {
                    // Получаем список пользователей
                    state.Users = await _roomManager.GetRoomUsersAsync(request.RoomId);

                    // Получаем новые сообщения с момента последней синхронизации
                    if (request.LastSyncTime.HasValue)
                    {
                        var newMessages = await _roomManager.GetMessagesSinceAsync(
                            request.RoomId,
                            request.LastSyncTime.Value
                        );
                        state.NewMessages = newMessages;
                        state.HasChanges = newMessages.Count() > 0;
                    }

                    // Обновляем время последней активности пользователя
                    await _presenceService.UpdateUserActivityAsync(request.UserId, request.RoomId);
                }

                return Ok(new { success = true, state });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Long Polling — клиент ждет новые сообщения
        /// Долгий опрос (Long Polling) - клиент ждет новых сообщений
        /// </summary>
        [HttpPost("poll")]
        public async Task<IActionResult> Poll([FromBody] PollRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RoomId) || string.IsNullOrEmpty(request.UserId))
                {
                    return BadRequest(new { error = "RoomId и UserId обязательны" });
                }

                // Проверяем существование комнаты
                var room = await _roomManager.GetRoomInfoAsync(request.RoomId);
                if (room == null)
                {
                    return NotFound(new { error = "Комната не найдена" });
                }

                // Получаем текущее количество сообщений
                var currentMessageCount = await _messageHistory.GetMessageCountAsync(request.RoomId);

                // Если есть новые сообщения с момента последнего запроса
                if (request.LastMessageCount.HasValue && currentMessageCount > request.LastMessageCount.Value)
                {
                    var newMessages = await _messageHistory.GetHistoryAsync(
                        request.RoomId,
                        currentMessageCount - request.LastMessageCount.Value,
                        request.LastMessageCount.Value
                    );

                    // Обновляем активность пользователя
                    await _presenceService.UpdateUserActivityAsync(request.UserId, request.RoomId);

                    return Ok(new
                    {
                        success = true,
                        hasNewMessages = true,
                        messages = newMessages,
                        messageCount = currentMessageCount,
                        users = await _roomManager.GetRoomUsersAsync(request.RoomId)
                    });
                }

                // Используем Long Polling — ждем новые сообщения
                var timeout = TimeSpan.FromSeconds(request.TimeoutSeconds ?? 30);
                var cts = new CancellationTokenSource(timeout);

                // Создаем задачу ожидания
                var pollTask = WaitForNewMessages(
                    request.RoomId,
                    request.UserId,
                    currentMessageCount,
                    cts.Token
                );

                var result = await pollTask;

                // Обновляем активность пользователя
                await _presenceService.UpdateUserActivityAsync(request.UserId, request.RoomId);

                return Ok(new
                {
                    success = true,
                    hasNewMessages = result.HasNewMessages,
                    messages = result.Messages ?? new List<ChatMessage>(),
                    messageCount = result.MessageCount,
                    users = await _roomManager.GetRoomUsersAsync(request.RoomId)
                });
            }
            catch (OperationCanceledException)
            {
                // Таймаут — новых сообщений нет
                return Ok(new
                {
                    success = true,
                    hasNewMessages = false,
                    messages = new List<ChatMessage>(),
                    messageCount = await _messageHistory.GetMessageCountAsync(request.RoomId)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private async Task<PollResult> WaitForNewMessages(
            string roomId,
            string userId,
            int lastMessageCount,
            CancellationToken cancellationToken)
        {
            var pollRequest = new PendingPollRequest
            {
                RoomId = roomId,
                UserId = userId,
                LastMessageCount = lastMessageCount,
                CompletionSource = new TaskCompletionSource<PollResult>()
            };

            // Регистрируем запрос
            lock (_pendingPolls)
            {
                if (!_pendingPolls.ContainsKey(roomId))
                {
                    _pendingPolls[roomId] = new List<PendingPollRequest>();
                }
                _pendingPolls[roomId].Add(pollRequest);
            }

            // Отменяем регистрацию при отмене
            using (cancellationToken.Register(() =>
            {
                lock (_pendingPolls)
                {
                    if (_pendingPolls.TryGetValue(roomId, out var list))
                    {
                        list.Remove(pollRequest);
                        if (list.Count == 0)
                        {
                            _pendingPolls.Remove(roomId);
                        }
                    }
                }
                pollRequest.CompletionSource.TrySetResult(new PollResult
                {
                    HasNewMessages = false,
                    MessageCount = lastMessageCount,
                    Messages = new List<ChatMessage>()
                });
            }))
            {
                try
                {
                    return await pollRequest.CompletionSource.Task;
                }
                finally
                {
                    // Гарантированно удаляем запрос из словаря после завершения
                    lock (_pendingPolls)
                    {
                        if (_pendingPolls.TryGetValue(roomId, out var list))
                        {
                            list.Remove(pollRequest);
                            if (list.Count == 0)
                                _pendingPolls.Remove(roomId);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Статический метод для уведомления о новых сообщениях (вызывается из RoomManager)
        /// </summary>
        public static void NotifyNewMessages(string roomId, ChatMessage message, int messageCount)
        {
            lock (_pendingPolls)
            {
                if (!_pendingPolls.TryGetValue(roomId, out var pendingList)) return;

                var result = new PollResult
                {
                    HasNewMessages = true,
                    MessageCount = messageCount,
                    Messages = new List<ChatMessage> { message }
                };

                foreach (var pending in pendingList.ToList())
                {
                    // Не отправляем сообщение обратно отправителю
                    if (pending.UserId != message.UserId) 
                    {
                        pending.CompletionSource.TrySetResult(result);
                        pendingList.Remove(pending);
                    }
                }

                if (pendingList.Count == 0)
                {
                    _pendingPolls.Remove(roomId);
                }
            }
        }

        /// <summary>
        /// Синхронизация статусов пользователей
        /// </summary>
        [HttpPost("users")]
        public async Task<IActionResult> SyncUsers([FromBody] SyncUsersRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RoomId))
                {
                    return BadRequest(new { error = "RoomId обязателен" });
                }

                // Обновляем статус пользователя
                if (!string.IsNullOrEmpty(request.UserId))
                {
                    await _presenceService.UpdateUserActivityAsync(request.UserId, request.RoomId);

                    if (request.IsTyping.HasValue)
                    {
                        await _presenceService.SetTypingStatusAsync(
                            request.UserId,
                            request.RoomId,
                            request.IsTyping.Value
                        );
                    }
                }

                // Получаем обновленный список пользователей
                var users = await _roomManager.GetRoomUsersAsync(request.RoomId);

                // Добавляем статус печатания
                var usersWithStatus = new List<UserStatusDto>();
                foreach (var user in users)
                {
                    var isTyping = await _presenceService.IsUserTypingAsync(user.Id, request.RoomId);
                    usersWithStatus.Add(new UserStatusDto
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Avatar = user.Avatar,
                        AvatarType = user.AvatarType,
                        AvatarData = user.AvatarData,
                        Color = user.Color,
                        IsTyping = isTyping,
                        LastSeen = user.LastSeen
                    });
                }

                return Ok(new
                {
                    success = true,
                    users = usersWithStatus,
                    totalUsers = usersWithStatus.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }


        /// <summary>
        /// Проверка доступности сервера
        /// </summary>
        [HttpGet("ping")]
        public IActionResult Ping()
        {
            return Ok(new
            {
                success = true,
                timestamp = DateTime.UtcNow,
                version = "1.0.0",
                serverTime = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            });
        }

        /// <summary>
        /// Получение статуса комнаты (список пользователей)
        /// </summary>
        [HttpGet("status/{roomId}")]
        public async Task<IActionResult> GetRoomStatus(string roomId)
        {
            try
            {
                var users = await _roomManager.GetRoomUsersAsync(roomId);
                var messageCount = await _messageHistory.GetMessageCountAsync(roomId);

                return Ok(new
                {
                    success = true,
                    users = users.Select(u => new
                    {
                        id = u.Id,
                        name = u.Name,
                        avatar = u.Avatar,
                        avatarType = u.AvatarType,
                        avatarData = u.AvatarData,
                        color = u.Color,
                        isTyping = u.IsTyping,
                        lastSeen = u.LastSeen
                    }),
                    messageCount,
                    onlineCount = users.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Обновление статуса печатания
        /// </summary>
        [HttpPost("typing")]
        public async Task<IActionResult> SetTypingStatus([FromBody] TypingStatusRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RoomId) || string.IsNullOrEmpty(request.UserId))
                {
                    return BadRequest(new { error = "RoomId и UserId обязательны" });
                }

                await _presenceService.SetTypingStatusAsync(
                    request.UserId,
                    request.RoomId,
                    request.IsTyping
                );

                // Уведомляем других пользователей в комнате через Long Polling
                NotifyTypingStatus(request.RoomId, request.UserId, request.IsTyping);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private static void NotifyTypingStatus(string roomId, string userId, bool isTyping)
        {
            // В реальном проекте здесь можно использовать SignalR или WebSocket
            // Для Long Polling статус печатания будет получен при следующем опросе
        }
    }

    // ===== DTO =====

    // DTO для запросов
    public class SyncStateRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public DateTime? LastSyncTime { get; set; }
    }



    public class PollRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public int? LastMessageCount { get; set; }
        public int? TimeoutSeconds { get; set; }
    }

    public class SyncUsersRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public bool? IsTyping { get; set; }
    }

    // DTO для ответов
    public class SyncStateResponse
    {
        public string RoomId { get; set; }
        public DateTime Timestamp { get; set; }
        public List<UserInfo> Users { get; set; }
        public List<ChatMessage> NewMessages { get; set; }
        public bool HasChanges { get; set; }
    }

    public class UserStatusDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string AvatarType { get; set; }
        public string AvatarData { get; set; }
        public string Color { get; set; }
        public bool IsTyping { get; set; }
        public DateTime LastSeen { get; set; }
    }

    public class SyncStats
    {
        public string RoomId { get; set; }
        public int TotalMessages { get; set; }
        public int OnlineUsers { get; set; }
        public DateTime LastActivity { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class PollResult
    {
        public bool HasNewMessages { get; set; }
        public int MessageCount { get; set; }
        public List<ChatMessage> Messages { get; set; }
        public List<UserInfo> Users { get; set; }
    }

    public class PendingPollRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public int LastMessageCount { get; set; }
        public TaskCompletionSource<PollResult> CompletionSource { get; set; }
    }

    public class TypingStatusRequest
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public bool IsTyping { get; set; }
    }
}