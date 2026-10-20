// Services/RoomManager.cs
using System;
//using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
//using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;
using InfocomChat.Server.Controllers;
using System.Text.Json;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Менеджер комнат с поддержкой транзакций и кэширования
    /// </summary>
    public class RoomManager
    {

        private readonly ChatDbContext _context;
        //private readonly ILogger<UserService> _logger;
        private readonly ILogger<RoomManager> _logger;        

        //private readonly ConcurrentDictionary<string, RoomInfo> _rooms = new ConcurrentDictionary<string, RoomInfo>();
        //private readonly ConcurrentDictionary<string, HashSet<string>> _userRooms = new ConcurrentDictionary<string, HashSet<string>>();
        //private readonly IMemoryCache _cache;
        private readonly MessageHistoryService _historyService;

        // Кэш для быстрого доступа к активным комнатам
        private readonly Dictionary<string, RoomInfo> _roomCache = new Dictionary<string, RoomInfo>();
        private readonly object _cacheLock = new object();

        public RoomManager(
            ChatDbContext context, 
            ILogger<RoomManager> logger,
            //IMemoryCache cache, 
            MessageHistoryService historyService)
        {
            //_cache = cache;
            
            _context = context;
            _logger = logger;
            _historyService = historyService;            
        }

        // === СОБЫТИЯ ДЛЯ SIGNALR ===

        /// <summary>Событие нового сообщения</summary>
        public Func<string, ChatMessage, Task> OnNewMessage { get; set; }
        
        /// <summary>Событие входа пользователя в комнату</summary>
        public Func<string, UserInfo, Task> OnUserJoined { get; set; }
        
        /// <summary>Событие выхода пользователя из комнаты</summary>
        public Func<string, string, Task> OnUserLeft { get; set; }
        
        /// <summary>Событие редактирования сообщения</summary>
        public Func<string, string, string, Task> OnMessageEdited { get; set; }
        
        /// <summary>Событие удаления сообщения</summary>
        public Func<string, string, Task> OnMessageDeleted { get; set; }

        /// <summary>Событие упоминания пользователя</summary>
        public Func<string, ChatMessage, string, Task> OnUserMentioned { get; set; }

        // === МЕТОДЫ УВЕДОМЛЕНИЙ ===

        public async Task NotifyNewMessageAsync(string roomId, ChatMessage message)
        {
            if (OnNewMessage != null)
            {
                await OnNewMessage(roomId, message);
            }
        }

        public async Task NotifyUserJoinedAsync(string roomId, UserInfo user)
        {
            if (OnUserJoined != null)
            {
                await OnUserJoined(roomId, user);
            }
        }

        public async Task NotifyUserLeftAsync(string roomId, string userId)
        {
            if (OnUserLeft != null)
            {
                await OnUserLeft(roomId, userId);
            }
        }

        public async Task NotifyMessageEditedAsync(string roomId, string messageId, string newContent)
        {
            if (OnMessageEdited != null)
            {
                await OnMessageEdited(roomId, messageId, newContent);
            }
        }

        public async Task NotifyMessageDeletedAsync(string roomId, string messageId)
        {
            if (OnMessageDeleted != null)
            {
                await OnMessageDeleted(roomId, messageId);
            }
        }  

        /// <summary>
        /// Уведомление об упоминании пользователя
        /// </summary>
        public async Task NotifyUserMentionedAsync(string userId, ChatMessage message, string mentionedBy)
        {
            if (OnUserMentioned != null)
                await OnUserMentioned(userId, message, mentionedBy);
        }

        // === УПРАВЛЕНИЕ КОМНАТАМИ ===              

        /// <summary>
        /// Создание новой комнаты с транзакцией
        /// </summary>
        public async Task<string> CreateRoomAsync(string name, string createdBy)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var roomId = "room_" + Guid.NewGuid().ToString().Substring(0, 8);

                var room = new Room
                {
                    RoomId = roomId,
                    Name = name ?? $"Комната {roomId}",
                    CreatedBy = createdBy,
                    CreatedAt = DateTime.UtcNow,
                    LastActivity = DateTime.UtcNow,
                    IsActive = true,
                    RoomType = "common",
                    Model = "local-model",
                    MessageCount = 0
                };

                await _context.Rooms.AddAsync(room);
                await _context.SaveChangesAsync();

                // Создаём историю сообщений для комнаты
                await _historyService.CreateRoomHistoryAsync(roomId);

                // Добавляем в кэш
                var roomInfo = MapToRoomInfo(room);
                lock (_cacheLock)
                {
                    _roomCache[roomId] = roomInfo;
                }

                await transaction.CommitAsync();

                _logger.LogInformation($"Создана комната {roomId}: {name}");
                return roomId;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка создания комнаты {name}");
                throw;
            }
        }

        /// <summary>
        /// Добавление пользователя в комнату с транзакцией
        /// </summary>
        public async Task<bool> AddUserToRoomAsync(string roomId, UserInfo user)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            
            try
            {
                // Проверяем существование и активность комнаты
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId && r.IsActive);

                if (room == null)
                    return false;

                // Получаем или создаём пользователя
                var userEntity = await _context.Users
                    .FirstOrDefaultAsync(u => u.UserId == user.Id);

                if (userEntity == null)
                {
                    userEntity = new User
                    {
                        UserId = user.Id,
                        Name = user.Name,
                        Avatar = user.Avatar,
                        AvatarType = user.AvatarType,
                        AvatarData = user.AvatarData,
                        Color = user.Color,
                        IsOnline = true,
                        Status = "online",
                        CreatedAt = DateTime.UtcNow,
                        LastSeen = DateTime.UtcNow,
                        Role = "User"
                    };
                    await _context.Users.AddAsync(userEntity);
                }
                else
                {
                    userEntity.IsOnline = true;
                    userEntity.LastSeen = DateTime.UtcNow;
                }

                // Проверяем, не в комнате ли уже пользователь
                var existing = await _context.UserRooms
                    .FirstOrDefaultAsync(ur => ur.UserId == user.Id && ur.RoomId == roomId);

                if (existing == null)
                {
                    var userRoom = new UserRoom
                    {
                        UserId = user.Id,
                        RoomId = roomId,
                        JoinedAt = DateTime.UtcNow,
                        LastActivity = DateTime.UtcNow,
                        IsActive = true
                    };
                    await _context.UserRooms.AddAsync(userRoom);
                }
                else
                {
                    existing.LastActivity = DateTime.UtcNow;
                    existing.IsActive = true;
                }

                // Обновляем активность комнаты
                room.LastActivity = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Обновляем кэш
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка добавления пользователя {user.Id} в комнату {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Добавление пользователя по ID в комнату с транзакцией
        /// </summary>
        public async Task<bool> AddUserIdToRoomAsync(string roomId, string userId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Проверяем существование и активность комнаты
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId && r.IsActive);

                if (room == null)
                    return false;

                // Получаем или создаём пользователя
                var userEntity = await _context.Users
                    .FirstOrDefaultAsync(u => u.UserId == userId);

                if (userEntity == null)
                {
                    return false;
                }
                else
                {
                    userEntity.IsOnline = true;
                    userEntity.LastSeen = DateTime.UtcNow;
                }

                // Проверяем, не в комнате ли уже пользователь
                var existing = await _context.UserRooms
                    .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoomId == roomId);

                if (existing == null)
                {
                    var userRoom = new UserRoom
                    {
                        UserId = userId,
                        RoomId = roomId,
                        JoinedAt = DateTime.UtcNow,
                        LastActivity = DateTime.UtcNow,
                        IsActive = true
                    };
                    await _context.UserRooms.AddAsync(userRoom);
                }
                else
                {
                    existing.LastActivity = DateTime.UtcNow;
                    existing.IsActive = true;
                }

                // Обновляем активность комнаты
                room.LastActivity = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Обновляем кэш
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка добавления пользователя {userId} в комнату {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Удаление пользователя из комнаты с транзакцией
        /// </summary>
        public async Task<bool> RemoveUserFromRoomAsync(string roomId, string userId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var userRoom = await _context.UserRooms
                    .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoomId == roomId);

                if (userRoom == null)
                    return false;

                userRoom.IsActive = false;
                userRoom.LastActivity = DateTime.UtcNow;

                // Проверяем, есть ли у пользователя другие активные комнаты
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.UserId == userId);

                if (user != null)
                {
                    var otherRooms = await _context.UserRooms
                        .AnyAsync(ur => ur.UserId == userId && ur.IsActive && ur.RoomId != roomId);

                    if (!otherRooms)
                    {
                        user.IsOnline = false;
                        user.Status = "offline";
                    }
                }

                // Обновляем активность комнаты
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room != null)
                {
                    room.LastActivity = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Обновляем кэш
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка удаления пользователя {userId} из комнаты {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Добавление сообщения в комнату с транзакцией
        /// </summary>
        public async Task<bool> AddMessageAsync(string roomId, ChatMessage message)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            
            try
            {
                // Сохраняем сообщение в БД
                var msg = new Message
                {
                    MessageId = message.Id,
                    RoomId = roomId,
                    UserId = message.UserId,
                    UserName = message.UserName,
                    UserAvatar = message.UserAvatar,
                    Role = message.Role,
                    Content = message.Content,
                    Timestamp = message.Timestamp,
                    ReplyToId = message.ReplyToId,
                    IsEdited = message.IsEdited,
                    Model = message.Model,
                    AttachmentsJson = message.Attachments != null 
                        ? JsonSerializer.Serialize(message.Attachments)
                        : "[]",
                    MetadataJson = message.Metadata != null 
                        ? JsonSerializer.Serialize(message.Metadata)
                        : "{}"
                };

                await _context.Messages.AddAsync(msg);

                // Обновляем счётчик сообщений в комнате
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room != null)
                {
                    room.MessageCount++;
                    room.LastActivity = DateTime.UtcNow;
                }

                // Обновляем счётчик сообщений пользователя
                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.UserId == message.UserId);

                if (user != null)
                {
                    user.MessageCount++;
                    user.LastMessageAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Добавляем в историю (кэш)
                await _historyService.AddMessageAsync(roomId, message);

                // Уведомляем Long Polling клиентов
                SyncController.NotifyNewMessages(roomId, message, room?.MessageCount ?? 0);

                // Обновляем кэш комнаты
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка добавления сообщения в комнату {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Редактирование сообщения
        /// </summary>
        public async Task<bool> EditMessageAsync(string roomId, string messageId, string userId, string newContent)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var message = await _context.Messages
                    .FirstOrDefaultAsync(m => m.MessageId == messageId && m.RoomId == roomId);

                if (message == null || message.UserId != userId)
                    return false;

                message.Content = newContent;
                message.IsEdited = true;
                message.EditedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Обновляем историю
                await _historyService.UpdateMessageAsync(roomId, messageId, newContent);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка редактирования сообщения {messageId}");
                return false;
            }
        }

        /// <summary>
        /// Удаление сообщения
        /// </summary>
        public async Task<bool> DeleteMessageAsync(string roomId, string messageId, string userId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var message = await _context.Messages
                    .FirstOrDefaultAsync(m => m.MessageId == messageId && m.RoomId == roomId);

                if (message == null || message.UserId != userId)
                    return false;

                _context.Messages.Remove(message);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Удаляем из истории
                await _historyService.DeleteMessageAsync(roomId, messageId);

                // Обновляем кэш
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка удаления сообщения {messageId}");
                return false;
            }
        }

        // === ПОЛУЧЕНИЕ ДАННЫХ ===

        /// <summary>
        /// Получение списка пользователей в комнате
        /// </summary>
        public async Task<List<UserInfo>> GetRoomUsersAsync(string roomId)
        {
            try
            {
                var userRooms = await _context.UserRooms
                    .Include(ur => ur.User)
                    .Where(ur => ur.RoomId == roomId && ur.IsActive)
                    .ToListAsync();

                return userRooms
                    .Where(ur => ur.User != null)
                    .Select(ur => new UserInfo
                    {
                        Id = ur.User.UserId,
                        Name = ur.User.Name,
                        Avatar = ur.User.Avatar,
                        AvatarType = ur.User.AvatarType,
                        AvatarData = ur.User.AvatarData,
                        Color = ur.User.Color,
                        LastSeen = ur.User.LastSeen,
                        Status = ur.User.Status,
                        RoomId = roomId
                    })
                    .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения пользователей комнаты {roomId}");
                return new List<UserInfo>();
            }
        }

        /// <summary>
        /// Получение истории сообщений из БД
        /// </summary>
        public async Task<List<ChatMessage>> GetRoomHistoryAsync(string roomId, int limit = 100)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId)
                        .OrderByDescending(m => m.Timestamp)
                        .Take(limit)
                    .OrderBy(m => m.Timestamp)
                    .ToListAsync();

                return messages.Select(MapToChatMessage).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения истории комнаты {roomId}");
                return new List<ChatMessage>();
            }
            //return new List<ChatMessage>();
        }

        /// <summary>
        /// Получение сообщений с указанного времени
        /// Используется для синхронизации
        /// </summary>
        public async Task<List<ChatMessage>> GetMessagesSinceAsync(string roomId, DateTime since)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId && m.Timestamp > since)
                    .OrderBy(m => m.Timestamp)
                    .ToListAsync();

                return messages.Select(MapToChatMessage).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сообщений с {since} в комнате {roomId}");
                return new List<ChatMessage>();
            }
        }

        /// <summary>
        /// Получение сообщений по диапазону дат
        /// </summary>

        public async Task<List<ChatMessage>> GetMessagesByDateRangeAsync(string roomId, DateTime from, DateTime to)
        {
            /*
            if (_rooms.TryGetValue(roomId, out var room))
            {
                lock (room)
                {
                    return room.Messages
                        .Where(m => m.Timestamp >= from && m.Timestamp <= to)
                        .OrderBy(m => m.Timestamp)
                        .ToList();
                }
            }
            return new List<ChatMessage>();
            */
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId && m.Timestamp >= from && m.Timestamp <= to)
                    .OrderBy(m => m.Timestamp)
                    .ToListAsync();

                return messages.Select(MapToChatMessage).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сообщений с {from} по {to} в комнате {roomId}");
                return new List<ChatMessage>();
            }
        }


        /// <summary>
        /// Получение последнего сообщения в комнате
        /// </summary>
        public async Task<ChatMessage> GetLastMessageAsync(string roomId)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId)
                    .OrderBy(m => m.Timestamp)
                    .ToListAsync();

                return messages.Select(MapToChatMessage).LastOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения последнего сообщения в комнате {roomId}");
                return new ChatMessage();
            }
        }

        /// <summary>
        /// Получение количества сообщений в комнате
        /// </summary>
        public async Task<int> GetMessageCountAsync(string roomId)
        {
            try
            {
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                return room?.MessageCount ?? 0;
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Получение информации о комнате из кэша или БД
        /// </summary>
        public async Task<RoomInfo> GetRoomInfoAsync(string roomId)
        {
            try
            {
                // Проверяем кэш
                lock (_cacheLock)
                {
                    if (_roomCache.TryGetValue(roomId, out var cachedRoom))
                    {
                        // Обновляем список пользователей из БД
                        var roomUsers = GetRoomUsersAsync(roomId).Result;
                        cachedRoom.Users = roomUsers;
                        return cachedRoom;
                    }
                }

                // Получаем из БД
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId && r.IsActive);

                if (room == null)
                    return null;

                var users = await GetRoomUsersAsync(roomId);
                var history = await GetRoomHistoryAsync(roomId, 100);
                var userCount = users.Count;
                var roomInfo = new RoomInfo
                {
                    RoomId = room.RoomId,
                    Name = room.Name,
                    Description = room.Description,
                    CreatedAt = room.CreatedAt,
                    CreatedBy = room.CreatedBy,
                    Users = users,
                    Messages = history,
                    MessageCount = room.MessageCount,
                    UserCount = userCount,
                    LastActivity = room.LastActivity,
                    Model = room.Model,
                    IsPrivate = room.IsPrivate,
                    IsActive = room.IsActive,
                    Settings = room.SettingsJson != null 
                        //? System.Text.Json.JsonSerializer.Deserialize<RoomSettings>(room.SettingsJson) 
                        ? JsonSerializer.Deserialize<RoomSettings>(room.SettingsJson) 
                        : new RoomSettings()
                };

                // Кэшируем
                lock (_cacheLock)
                {
                    _roomCache[roomId] = roomInfo;
                }

                return roomInfo;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения информации о комнате {roomId}");
                return null;
            }
        }

        /// <summary>
        /// Получение списка активных комнат
        /// </summary>
        public async Task<List<RoomInfo>> GetActiveRoomsAsync()
        {
            try
            {
                var rooms = await _context.Rooms
                    .Where(r => r.IsActive)
                    .OrderByDescending(r => r.LastActivity)
                    .Take(50)
                    .ToListAsync();

                var result = new List<RoomInfo>();

                foreach (var room in rooms)
                {
                    var roomInfo = await GetRoomInfoAsync(room.RoomId);
                    if (roomInfo != null)
                    {
                        // Обновляем количество пользователей
                        var users = await GetRoomUsersAsync(room.RoomId);
                        roomInfo.Users = users;
                        result.Add(roomInfo);
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения активных комнат");
                return new List<RoomInfo>();
            }
        }

        /// <summary>
        /// Получение сообщений после указанного ID
        /// </summary>
        public async Task<List<ChatMessage>> GetMessagesAfterIdAsync(string roomId, string lastMessageId)
        {/*
            if (_rooms.TryGetValue(roomId, out var room))
            {
                lock (room)
                {
                    var lastIndex = room.Messages.FindIndex(m => m.Id == lastMessageId);
                    if (lastIndex >= 0 && lastIndex < room.Messages.Count - 1)
                    {
                        return room.Messages
                            .Skip(lastIndex + 1)
                            .ToList();
                    }
                    return new List<ChatMessage>();
                }
            }
            return new List<ChatMessage>();
            */
            try { 
                var lastIndexMessageTimestamp = await _context.Messages
                    .Where(m => m.RoomId == roomId && m.MessageId == lastMessageId)
                    .OrderBy(m => m.Timestamp)
                    .FirstOrDefaultAsync();
                var ts = lastIndexMessageTimestamp.Timestamp;
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId && m.Timestamp >= ts && m.MessageId != lastMessageId)
                    .OrderBy(m => m.Timestamp)
                    .ToListAsync();
                return messages.Select(MapToChatMessage).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения сообщений после указанного ID {lastMessageId} в комнате {roomId}");
                return new List<ChatMessage>();
            }
        }

        /// <summary>
        /// Поиск сообщений по тексту
        /// </summary>
        public async Task<List<ChatMessage>> SearchMessagesAsync(string roomId, string searchTerm, int limit = 50)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return new List<ChatMessage>();

            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId && 
                                m.Content != null &&
                                m.Content.Contains(searchTerm))
                        .OrderByDescending(m => m.Timestamp)
                        .Take(limit)
                    .ToListAsync();

                return messages.Select(MapToChatMessage).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка поиска сообщений в комнате {roomId}");
            return new List<ChatMessage>();
            }
        }

        /// <summary>
        /// Получение статистики сообщений в комнате
        /// </summary>
        public async Task<MessageStats> GetMessageStatsAsync(string roomId)
        {
            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId)
                    .ToListAsync();

                    return new MessageStats
                    {
                    TotalMessages = messages.Count,
                    UserMessages = messages.Count(m => m.Role == "user"),
                    AssistantMessages = messages.Count(m => m.Role == "assistant"),
                    EditedMessages = messages.Count(m => m.IsEdited),
                    FirstMessageTime = messages.OrderBy(m => m.Timestamp).FirstOrDefault()?.Timestamp,
                    LastMessageTime = messages.OrderByDescending(m => m.Timestamp).FirstOrDefault()?.Timestamp
                    };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения статистики комнаты {roomId}");
                return new MessageStats();
            }
        }

        /*
        public async Task<List<RoomInfo>> GetActiveRoomsAsync()
        {
            return _rooms.Values
                .Where(r => r.Users.Any() || r.LastActivity > DateTime.UtcNow.AddMinutes(-30))
                .ToList();
        }
        */

        /*
        public async Task<RoomInfo> GetRoomInfoAsync(string roomId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                lock (room)
                {
                    // Создаем копию для безопасности
                    return new RoomInfo
                    {
                        RoomId = room.RoomId,
                        Name = room.Name,
                        CreatedAt = room.CreatedAt,
                        Users = room.Users.Select(u => new UserInfo
                        {
                            Id = u.Id,
                            Name = u.Name,
                            Avatar = u.Avatar,
                            Color = u.Color,
                            IsTyping = u.IsTyping,
                            LastSeen = u.LastSeen,
                            RoomId = u.RoomId,
                            Status = u.Status
                        }).ToList(),
                        Messages = room.Messages.TakeLast(100).ToList(),
                        MessageCount = room.MessageCount,
                        LastActivity = room.LastActivity,
                        Model = room.Model,
                        Settings = room.Settings
                    };
                }
            }
            return null;
        }
        */

        // === УПРАВЛЕНИЕ КОМНАТАМИ (АДМИН) ===
        
        /// <summary>
        /// Очистка истории сообщений в комнате с транзакцией
        /// </summary>
        public async Task<bool> ClearRoomHistoryAsync(string roomId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var messages = await _context.Messages
                    .Where(m => m.RoomId == roomId)
                    .ToListAsync();

                _context.Messages.RemoveRange(messages);

                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room != null)
                {
                    room.MessageCount = 0;
                    room.LastActivity = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                await _historyService.ClearHistoryAsync(roomId);

                // Обновляем кэш
                UpdateRoomCache(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка очистки истории комнаты {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Удаление комнаты (мягкое удаление) с транзакцией
        /// </summary>
        public async Task<bool> DeleteRoomAsync(string roomId)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room == null)
                    return false;

                room.IsActive = false;

                // Деактивируем связи пользователей
                var userRooms = await _context.UserRooms
                    .Where(ur => ur.RoomId == roomId)
                    .ToListAsync();

                foreach (var ur in userRooms)
                {
                    ur.IsActive = false;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                // Удаляем из кэша
                lock (_cacheLock)
                {
                    _roomCache.Remove(roomId);
                }

                await _historyService.ClearHistoryAsync(roomId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка удаления комнаты {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Обновление модели комнаты
        /// </summary>
        public async Task<bool> UpdateRoomModelAsync(string roomId, string model)
        {
            try
            {
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room == null)
                    return false;

                room.Model = model;
                room.LastActivity = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                UpdateRoomCache(roomId);

                    return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления модели комнаты {roomId}");
                return false;
            }
        }

        /// <summary>
        /// Обновление настроек комнаты
        /// </summary>
        public async Task<bool> UpdateRoomSettingsAsync(string roomId, RoomSettings settings)
        {
            try
            {
                var room = await _context.Rooms
                    .FirstOrDefaultAsync(r => r.RoomId == roomId);

                if (room == null)
                    return false;

                //room.SettingsJson = System.Text.Json.JsonSerializer.Serialize(settings);
                room.SettingsJson = JsonSerializer.Serialize(settings);
                room.LastActivity = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                UpdateRoomCache(roomId);

                    return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка обновления настроек комнаты {roomId}");
                return false;
            }
        }

        // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

        /// <summary>
        /// Обновление кэша комнаты
        /// </summary>
        private void UpdateRoomCache(string roomId)
        {
            lock (_cacheLock)
            {
                _roomCache.Remove(roomId);
            }
        }

        /// <summary>
        /// Маппинг из Entity Message в ChatMessage
        /// </summary>
        private ChatMessage MapToChatMessage(Message message)
        {
            return new ChatMessage
            {
                Id = message.MessageId,
                RoomId = message.RoomId,
                UserId = message.UserId,
                UserName = message.UserName,
                UserAvatar = message.UserAvatar,
                Role = message.Role,
                Content = message.Content,
                Timestamp = message.Timestamp,
                ReplyToId = message.ReplyToId,
                IsEdited = message.IsEdited,
                Model = message.Model,
                Attachments = !string.IsNullOrEmpty(message.AttachmentsJson)
                    //? System.Text.Json.JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    ? JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    : new List<FileAttachment>(),
                Metadata = !string.IsNullOrEmpty(message.MetadataJson)
                    //? System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(message.MetadataJson)
                    ? JsonSerializer.Deserialize<Dictionary<string, object>>(message.MetadataJson)
                    : new Dictionary<string, object>()
            };
        }

        /// <summary>
        /// Маппинг из Entity Room в RoomInfo
        /// </summary>
        private RoomInfo MapToRoomInfo(Room room)
        {
            return new RoomInfo
            {
                RoomId = room.RoomId,
                Name = room.Name,
                Description = room.Description,
                CreatedAt = room.CreatedAt,
                CreatedBy = room.CreatedBy,
                MessageCount = room.MessageCount,
                UserCount = room.UserRooms?.Count ?? 0,
                LastActivity = room.LastActivity,
                Model = room.Model,
                IsPrivate = room.IsPrivate,
                IsActive = room.IsActive,
                Settings = !string.IsNullOrEmpty(room.SettingsJson)
                    //? System.Text.Json.JsonSerializer.Deserialize<RoomSettings>(room.SettingsJson)
                    ? JsonSerializer.Deserialize<RoomSettings>(room.SettingsJson)                    
                    : new RoomSettings()
            };
        }

        // === EVENTS FOR SIGNALR ===
        // События для SignalR
/*
        public Func<string, ChatMessage, Task> OnNewMessage { get; set; }
        public Func<string, UserInfo, Task> OnUserJoined { get; set; }
        public Func<string, string, Task> OnUserLeft { get; set; }
        public Func<string, string, string, Task> OnMessageEdited { get; set; }
        public Func<string, string, Task> OnMessageDeleted { get; set; }
*/
        /// <summary>
        /// Получение количества сообщений в комнате УЖЕ РАНЕЕ
        /// </summary>
        /// 
        /*
        public async Task<int> GetMessageCountAsync(string roomId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                lock (room)
                {
                    return room.Messages.Count;
                }
            }
            return 0;
        }
        */

        /*
        // Очистка истории сообщений в комнате
        public async Task<bool> ClearRoomHistoryAsync(string roomId)
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                lock (room)
                {
                    room.Messages.Clear();
                    room.MessageCount = 0;
                    room.LastActivity = DateTime.UtcNow;
                    return true;
                }
            }
            return false;
        }
        */

        /*
        // Удаление комнаты        
        public async Task<bool> DeleteRoomAsync(string roomId)
        {

            if (_rooms.TryRemove(roomId, out var room))
            {
                // Удаляем всех пользователей из комнаты
                foreach (var user in room.Users)
                {
                    if (_userRooms.TryGetValue(user.Id, out var roomSet))
                    {
                        roomSet.Remove(roomId);
                        if (roomSet.Count == 0)
                        {
                            _userRooms.TryRemove(user.Id, out _);
                        }
                    }
                }

                await _historyService.ClearHistoryAsync(roomId);
                return true;
            }
            return false;
        }
        */
    }

    /// <summary>
    /// Статистика сообщений в комнате МОЖЕТ НЕ НАДО
    /// </summary>
    /// 
    public class MessageStats
    {
        public int TotalMessages { get; set; }
        public int UserMessages { get; set; }
        public int AssistantMessages { get; set; }
        public int EditedMessages { get; set; }
        public DateTime? FirstMessageTime { get; set; }
        public DateTime? LastMessageTime { get; set; }
    }
}