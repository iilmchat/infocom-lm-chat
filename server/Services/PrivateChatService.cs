// Services/PrivateChatService.cs
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;
using PrivateMessage = InfocomChat.Server.Models.Entities.PrivateMessage;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис приватных чатов с поддержкой транзакций
    /// </summary>
    public class PrivateChatService
    {
        private readonly ChatDbContext _context;
        private readonly UserService _userService;
        private readonly UserPresenceService _presenceService; // Добавлен
        private readonly ILogger<PrivateChatService> _logger;

        // Удалён _userHeartbeats, теперь используем UserPresenceService
        //private readonly ConcurrentDictionary<string, DateTime> _userHeartbeats = new ConcurrentDictionary<string, DateTime>();

        public PrivateChatService(
            ChatDbContext context,
            UserService userService,
            UserPresenceService presenceService,
            ILogger<PrivateChatService> logger)
        {
            _context = context;
            _userService = userService;
            _presenceService = presenceService;
            _logger = logger;
        }

        // ===== ПРИВАТНЫЕ ЧАТЫ =====

        /// <summary>
        /// Получение или создание приватного чата с транзакцией
        /// </summary>
        public async Task<string> GetOrCreatePrivateChatAsync(string user1Id, string user2Id)
        {
            if (user1Id == user2Id)
                throw new ArgumentException("Нельзя создать чат с самим собой");

            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
            // Проверяем существование чата
            var existing = await _context.PrivateChats
                .FirstOrDefaultAsync(pc =>
                    (pc.User1Id == user1Id && pc.User2Id == user2Id) ||
                    (pc.User1Id == user2Id && pc.User2Id == user1Id));

            if (existing != null)
            {
                existing.LastActivity = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                return existing.ChatId;
            }

            // Создаём новый чат
            //var chat = new entitiesModels.PrivateChat
            var chat = new PrivateChat
            {
                ChatId = $"priv_{Guid.NewGuid().ToString().Substring(0, 8)}",
                User1Id = user1Id,
                User2Id = user2Id,
                CreatedAt = DateTime.UtcNow,
                LastActivity = DateTime.UtcNow,
                IsActive = true
            };

            await _context.PrivateChats.AddAsync(chat);
            await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation($"Создан приватный чат {chat.ChatId} между {user1Id} и {user2Id}");
            return chat.ChatId;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка создания приватного чата между {user1Id} и {user2Id}");
                throw;
            }
        }

        /// <summary>
        /// Получение всех чатов пользователя (Получить список чатов пользователя с использованием DTO для избежания циклических ссылок)
        /// </summary>
        //public async Task<List<entitiesModels.PrivateChat>> GetUserChatsAsync(string userId)
        public async Task<List<PrivateChatDto>> GetUserChatsAsync(string userId)        
        {
            var privateChats = await _context.PrivateChats
                .Include(pc => pc.PrivateMessages)
                .Where(pc => pc.User1Id == userId || pc.User2Id == userId)
                .OrderByDescending(pc => pc.LastActivity)
                //.Select(MapPrivateMessageToPrivateMessageDto)
                .ToListAsync();
            return privateChats.Select(MapPrivateChatToPrivateChatDto).ToList();
        }

        /// <summary>
        /// Отправка приватного сообщения с транзакцией
        /// </summary>
        //public async Task<entitiesModels.PrivateMessage> SendPrivateMessageAsync(
        public async Task<PrivateMessageDto> SendPrivateMessageAsync(        
            string chatId,
            string senderId,
            string receiverId,
            string content,
            string replyToId = null)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Проверяем, не забанен ли отправитель
                if (await _userService.IsUserBannedAsync(senderId))
                    throw new Exception("Вы забанены");

                // Проверяем, не заглушен ли отправитель
                if (await _userService.IsUserMutedAsync(senderId))
                    throw new Exception("Вы временно заблокированы");

                // Проверяем, не заблокировал ли получатель отправителя
                var isBlocked = await _context.BlockedUsers
                    .AnyAsync(b => b.UserId == receiverId && b.BlockedUserId == senderId);

                if (isBlocked)
                    throw new Exception("Пользователь заблокировал вас");

                // Проверяем существование чата
                var chat = await _context.PrivateChats
                    .FirstOrDefaultAsync(pc => pc.ChatId == chatId);

                if (chat == null)
                    throw new Exception("Чат не найден");

                // Получаем информацию об отправителе и получателе
                var sender = //await _userService.GetUserAsync(senderId);
                    await _context.Users
                        .Include(u => u.UserRooms)
                        .FirstOrDefaultAsync(u => u.UserId == senderId);
                var receiver = //await _userService.GetUserAsync(receiverId);
                    await _context.Users
                        .Include(u => u.UserRooms)
                        .FirstOrDefaultAsync(u => u.UserId == receiverId);

                // Создаём сообщение
                var message = new PrivateMessage
                {
                    MessageId = Guid.NewGuid().ToString(),
                    ChatId = chatId,
                    SenderId = senderId,
                    SenderName = sender?.Name ?? "Unknown",
                    SenderAvatar = sender?.Avatar ?? "👤",
                    SenderAvatarType = sender?.AvatarType ?? "emoji",
                    SenderAvatarData= sender?.AvatarData ?? "",
                    ReceiverId = receiverId,
                    Content = content,
                    Timestamp = DateTime.UtcNow,
                    IsRead = false,
                    ReplyToId = replyToId,
                    IsEdited = false
                };

                await _context.PrivateMessages.AddAsync(message);

                // Обновляем информацию о чате
                chat.LastActivity = DateTime.UtcNow;
                chat.LastMessage = content;
                chat.LastMessageAt = DateTime.UtcNow;

                // Увеличиваем счётчик непрочитанных у получателя
                if (receiver != null)
                {
                    receiver.UnreadCount = (receiver?.UnreadCount ?? 0) + 1;
                }

                // Увеличиваем счётчик сообщений у отправителя
                if (sender != null)
                {
                    sender.MessageCount = (sender?.MessageCount ?? 0) + 1;
                    sender.LastMessageAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation($"Отправлено приватное сообщение {message.MessageId} от {senderId} к {receiverId}");
                return  MapPrivateMessageToPrivateMessageDto(message);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка отправки приватного сообщения от {senderId} к {receiverId}");
                throw;
            }
        }

        /// <summary>
        /// Получение истории приватного чата
        /// </summary>
        //public async Task<List<entitiesModels.PrivateMessage>> GetPrivateMessagesAsync(
        public async Task<List<PrivateMessageDto>> GetPrivateMessagesAsync(        
            string chatId,
            int limit = 50,
            int offset = 0)
        {
            var messages = await _context.PrivateMessages
                .Where(pm => pm.ChatId == chatId)
                .OrderByDescending(pm => pm.Timestamp)
                .Skip(offset)
                .Take(limit)
                .OrderBy(pm => pm.Timestamp)
                .ToListAsync();
            return messages.Select(MapPrivateMessageToPrivateMessageDto).ToList();
        }

        /// <summary>
        /// Отметка сообщений как прочитанных с транзакцией
        /// </summary>
        public async Task<bool> MarkMessagesAsReadAsync(string chatId, string userId)
           {
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var unreadMessages = await _context.PrivateMessages
                    .Where(pm => pm.ChatId == chatId && 
                                    pm.ReceiverId == userId && 
                                    !pm.IsRead)
                    .ToListAsync();

                if (unreadMessages.Count == 0)
                    return true;

                foreach (var msg in unreadMessages)
                {
                    msg.IsRead = true;
                    msg.ReadAt = DateTime.UtcNow;
                }

                // Сбрасываем счётчик непрочитанных у пользователя
                var user = await _userService.GetUserModelAsync(userId);
                if (user != null)
                {
                    user.UnreadCount = 0;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка отметки сообщений как прочитанных в чате {chatId}");
                return false;
            }
        }

        /// <summary>
        /// Получение количества непрочитанных сообщений
        /// </summary>
        public async Task<int> GetUnreadCountAsync(string userId)
        {
            var user = await _userService.GetUserModelAsync(userId); 
            if (user != null)
            {
                return user.UnreadCount;
            }
            return 0;
        }

        /// <summary>
        /// Удаление приватного сообщения
        /// </summary>
        public async Task<bool> DeletePrivateMessageAsync(string messageId, string userId)
        {
            var message = await _context.PrivateMessages
                .FirstOrDefaultAsync(pm => pm.MessageId == messageId);

            if (message == null || message.SenderId != userId)
                return false;

            _context.PrivateMessages.Remove(message);
            await _context.SaveChangesAsync();

            return true;
        }

        /// <summary>
        /// Редактирование приватного сообщения
        /// </summary>
        public async Task<bool> EditPrivateMessageAsync(string messageId, string userId, string newContent)
        {
            var message = await _context.PrivateMessages
                .FirstOrDefaultAsync(pm => pm.MessageId == messageId);

            if (message == null || message.SenderId != userId)
                return false;

            message.Content = newContent;
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        // === БЛОКИРОВКА ===

        /// <summary>
        /// Блокировка пользователя
        /// </summary>
        public async Task<bool> BlockUserAsync(string userId, string blockUserId)
        {
            if (userId == blockUserId)
                return false;

            var existing = await _context.BlockedUsers
                .FirstOrDefaultAsync(b => b.UserId == userId && b.BlockedUserId == blockUserId);

            if (existing != null)
                return true;

            //var block = new entitiesModels.BlockedUser
            var block = new BlockedUser            
            {
                UserId = userId,
                BlockedUserId = blockUserId,
                BlockedAt = DateTime.UtcNow
            };

            await _context.BlockedUsers.AddAsync(block);
            await _context.SaveChangesAsync();

            return true;
        }

        /// <summary>
        /// Разблокировка пользователя
        /// </summary>
        public async Task<bool> UnblockUserAsync(string userId, string blockUserId)
        {
            var block = await _context.BlockedUsers
                .FirstOrDefaultAsync(b => b.UserId == userId && b.BlockedUserId == blockUserId);

            if (block == null)
                return false;

            _context.BlockedUsers.Remove(block);
            await _context.SaveChangesAsync();

            return true;
        }

        /// <summary>
        /// Получение списка заблокированных пользователей
        /// </summary>
        public async Task<List<string>> GetBlockedUsersAsync(string userId)
        {
            return await _context.BlockedUsers
                .Where(b => b.UserId == userId)
                .Select(b => b.BlockedUserId)
                .ToListAsync();
        }

        // === СТАТИСТИКА ===

        /// <summary>
        /// Получение общей статистики
        /// </summary>
        public async Task<AdminStats> GetStatsAsync()
        {
            var totalUsers = await _context.Users.CountAsync();
            var onlineUsers = await _context.Users.CountAsync(u => u.IsOnline);
            var totalChats = await _context.PrivateChats.CountAsync();
            var totalMessages = await _context.Messages.CountAsync();
            var totalRooms = await _context.Rooms.CountAsync(r => r.IsActive); // только активные комнаты
            var totalPrivateMessages = await _context.PrivateMessages.CountAsync();
            var bannedUsers = await _context.Users.CountAsync(u => u.Status == "banned");
            var mutedUsers = await _context.Users.CountAsync(u => u.MutedUntil.HasValue && u.MutedUntil.Value > DateTime.UtcNow);

            return new AdminStats()
            {
                TotalUsers = totalUsers,
                OnlineUsers = onlineUsers,
                TotalChats = totalChats,
                TotalMessages = totalMessages,
                TotalRooms = totalRooms,
                PrivateMessages = totalPrivateMessages,
                Timestamp = DateTime.UtcNow,
                BannedUsers = bannedUsers,
                MutedUsers = mutedUsers,
                Uptime = DateTime.UtcNow,
            };
        }

        /// <summary>
        /// Очистка всех данных (админ-функция)
        /// </summary>
        public async Task<bool> ClearAllData()
        {
            /*
            _chats.Clear();
            _users.Clear();
            _moderationLog.Clear();
            _userHeartbeats.Clear();
            */

            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                _context.PrivateMessages.RemoveRange(await _context.PrivateMessages.ToListAsync());
                _context.PrivateChats.RemoveRange(await _context.PrivateChats.ToListAsync());
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Ошибка очистки всех данных");
                return false;
            }
        }

        // ===== HEARTBEAT (используем UserPresenceService) =====

        /// <summary>
        /// Обновление статуса активности пользователя
        /// </summary>
        public async Task<bool> UpdateHeartbeatAsync(string userId)
        {
            // Получаем текущую комнату пользователя (если есть)
            var user = await _userService.GetUserAsync(userId);
            if (user == null)
                return false;

            // Используем присутствие для обновления
            if (user.RoomId != null)
            {
                await _presenceService.UpdateUserActivityAsync(userId, user.RoomId);
            }
            await _userService.UpdateUserStatusAsync(userId, true, "online");
            return true;
        }

/*        public async Task<bool> UpdateHeartbeatAsync(string userId)
        {
            var user = await _userService.GetUserModelAsync(userId); 
            if (user != null)
            {
                //user.LastSeen = DateTime.UtcNow;
                //user.IsOnline = true;

                await _userService.UpdateUserStatusAsync(userId, true, "online");
                _userHeartbeats[userId] = DateTime.UtcNow;

                //await _context.SaveChangesAsync();

                return true;
            }
            return false;
        }
*/

        /// <summary>
        /// Проверка и очистка неактивных пользователей (делегируем в UserPresenceService)
        /// </summary>
        public async Task CheckInactiveUsersAsync()
        {
            /*
            var now = DateTime.UtcNow;
            var users = await _userService.GetAllUsersAsync();
            var inactive = users.Where(u => u.IsOnline && (now - u.LastSeen).TotalMinutes > 5);

            foreach (var user in inactive)
            {
                //user.IsOnline = false;
                //user.Status = "offline";
                await _userService.UpdateUserStatusAsync(user.Id, false, "offline");
            }
            //await _context.SaveChangesAsync();
            */
            await _presenceService.CleanupInactiveUsersAsync();            
        }       

        // ===== ПРОКСИ К USER SERVICE =====
        
        public async Task<bool> MuteUserAsync(string userId, int minutes, string moderatorId, string reason)
        {
            return await _userService.MuteUserAsync(userId, minutes, moderatorId, reason);
        }
       
        public async Task<bool> KickUserAsync(string userId, string roomId, string moderatorId)
        {
            return await _userService.KickUserAsync(userId, roomId, moderatorId);
        }

        public async Task<bool> BanUserAsync(string userId, string moderatorId, string reason)
        {
            return await _userService.BanUserAsync(userId, moderatorId, reason);
        }

        public async Task<bool> UnbanUserAsync(string userId, string moderatorId)
        {
            return await _userService.UnbanUserAsync(userId, moderatorId);
        }

        public async Task<bool> IsUserMutedAsync(string userId)
        {
            return await _userService.IsUserMutedAsync(userId);
        }

        //public async Task<List<entitiesModels.ModerationLog>> GetModerationLogAsync(string userId, int limit = 100)
        public async Task<List<ModerationLog>> GetModerationLogAsync(string userId = null, int limit = 100)        
        {
            return await _userService.GetModerationLogsAsync(userId, limit);
        }

        // === ПРОКСИ К USER SERVICE ===
        // === Управление пользователями ===

        /// <summary>
        /// Получение или создание пользователя
        /// </summary>
        //public async Task<entitiesModels.User> GetOrCreateUserAsync(string userId, string name, string avatar, string color)
        public async Task<UserInfoDto> GetOrCreateUserAsync(string userId, string name, string avatar, string color, string avatartype, string avatardata)
        {
            return await _userService.GetOrCreateUserAsync(userId, name, avatar, color, avatartype, avatardata);
        }


        /// <summary>
        /// Получение пользователя
        /// </summary>
        //public async Task<entitiesModels.User> GetUserAsync(string userId)
        public async Task<UserInfoDto> GetUserAsync(string userId)
        {
            return await _userService.GetUserAsync(userId); // получаем DTO
        }

        /// <summary>
        /// Получение всех пользователей
        /// </summary>
        //public async Task<List<entitiesModels.User>> GetAllUsersAsync()
        public async Task<List<UserInfoDto>> GetAllUsersAsync()
        {
            return await _userService.GetAllUsersAsync();
        }

        /// <summary>
        /// Получение онлайн-пользователей
        /// </summary>
        //public async Task<List<entitiesModels.User>> GetOnlineUsersAsync()
        public async Task<List<UserInfoDto>> GetOnlineUsersAsync()
        {
            return await _userService.GetActiveUsersAsync(10);
        }

        //public async Task<List<entitiesModels.User>> SearchUsersAsync(string query)
        public async Task<List<UserInfoDto>> SearchUsersAsync(string query)        
        {
            return await _userService.SearchUsersAsync(query);
        }

        //public async Task<entitiesModels.User> GetUserWithBlocksAsync(string userId)
        public async Task<UserInfoDto> GetUserWithBlocksAsync(string userId)
        {
            return await _userService.GetUserWithBlocksAsync(userId);
        }

        public async Task<bool> IsAdminAsync(string userId)
        {
            return await _userService.IsAdminAsync(userId);
        }

        public async Task<bool> IsModeratorAsync(string userId)
        {
            return await _userService.IsModeratorAsync(userId);
        }

        // ===== МАППИНГ =====

/*
        private PrivateMessageDto MapPrivateMessageToPrivateMessageDto(PrivateMessage message) {  }
        private PrivateChatDto MapPrivateChatToPrivateChatDto(PrivateChat chat) { }
*/

        /// <summary>
        /// Маппинг из Entity PrivateMessage в PrivateMessageDto
        /// </summary>
        private PrivateMessageDto MapPrivateMessageToPrivateMessageDto(PrivateMessage message)
        {
            return new PrivateMessageDto
            {
                MessageId = message.MessageId,
                ChatId = message.ChatId,
                SenderId = message.SenderId,
                ReceiverId = message.ReceiverId,
                SenderName = message.SenderName,
                SenderAvatar = message.SenderAvatar,
                Content = message.Content,
                Timestamp = message.Timestamp,
                IsRead = message.IsRead,
                ReadAt = message.ReadAt,
                ReplyToId = message.ReplyToId,
                IsEdited = message.IsEdited,
                EditedAt = message.EditedAt,
                Attachments = !string.IsNullOrEmpty(message.AttachmentsJson)
                    //? System.Text.Json.JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    ? JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    : new List<FileAttachment>(),
                AttachmentsJson = message.AttachmentsJson
            };
        }

        /// <summary>
        /// Маппинг из Entity PrivateChat в PrivateChatDto
        /// </summary>
        private PrivateChatDto MapPrivateChatToPrivateChatDto(PrivateChat chat/*,string userId*/)
        {
            // Преобразуем сущности в DTO, чтобы избежать циклических ссылок
            //var isUser1 = chat.User1Id == userId;
            var user1Dto = chat.User1 != null ? new UserPreviewDto
            {
                UserId = chat.User1.UserId,
                Name = chat.User1.Name,
                Avatar = chat.User1.Avatar,
                AvatarType = chat.User1.AvatarType,
                AvatarData = chat.User1.AvatarData,
                Color = chat.User1.Color,
                Status = chat.User1.Status,
                IsOnline = chat.User1.IsOnline
            } : null;

            var user2Dto = chat.User2 != null ? new UserPreviewDto
            {
                UserId = chat.User2.UserId,
                Name = chat.User2.Name,
                Avatar = chat.User2.Avatar,
                AvatarType = chat.User2.AvatarType,
                AvatarData = chat.User2.AvatarData,
                Color = chat.User2.Color,
                Status = chat.User2.Status,
                IsOnline = chat.User2.IsOnline
            } : null;

            // Формируем DTO чата
            var chatDto = new PrivateChatDto
            {
                ChatId = chat.ChatId,
                User1Id = chat.User1Id,
                User2Id = chat.User2Id,
                LastMessage = chat.LastMessage,
                LastMessageAt = chat.LastMessageAt,
                CreatedAt = chat.CreatedAt,
                LastActivity = chat.LastActivity,
                IsActive = chat.IsActive,
                User1 = user1Dto,
                User2 = user2Dto
            };

            // Преобразуем сообщения в DTO
            if (chat.PrivateMessages != null)
            {
                chatDto.PrivateMessages = chat.PrivateMessages.Select(msg => new PrivateMessageDto
                {
                    MessageId = msg.MessageId,
                    ChatId = msg.ChatId,
                    SenderId = msg.SenderId,
                    ReceiverId = msg.ReceiverId,
                    SenderName = msg.SenderName,
                    SenderAvatar = msg.SenderAvatar,
                    SenderAvatarType = msg.SenderAvatarType,
                    SenderAvatarData = msg.SenderAvatarData,
                    Content = msg.Content,
                    Timestamp = msg.Timestamp,
                    IsRead = msg.IsRead,
                    ReadAt = msg.ReadAt,
                    ReplyToId = msg.ReplyToId,
                    IsEdited = msg.IsEdited,
                    EditedAt = msg.EditedAt,
                    Attachments = !string.IsNullOrEmpty(msg.AttachmentsJson)
                        //? System.Text.Json.JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                        ? JsonSerializer.Deserialize<List<FileAttachment>>(msg.AttachmentsJson)
                        : new List<FileAttachment>(),
                    AttachmentsJson = msg.AttachmentsJson
                }).ToList();
            }

            return chatDto;
        }

        //СТАРАЯ РЕАЛИЗАЦИЯ
        /*
        public async Task<UserProfile> GetOrCreateUser(string userId, string name, string avatar, string color)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.Name = name;
                user.Avatar = avatar;
                user.Color = color;
                user.LastSeen = DateTime.UtcNow;
                user.IsOnline = true;
                return user;
            }

            user = new UserProfile
            {
                Id = userId,
                Name = name,
                Avatar = avatar,
                Color = color,
                LastSeen = DateTime.UtcNow,
                IsOnline = true,
                Rooms = new List<string>(),
                BlockedUsers = new List<string>(),
                CreatedAt = DateTime.UtcNow,
                IsAdmin = false,
                IsModerator = false,
                UnreadCount = 0,
                MessageCount = 0
            };

            _users.TryAdd(userId, user);
            return user;
        }
                */
        /*
        public async Task<UserProfile> GetUser(string userId)
        {
            _users.TryGetValue(userId, out var user);
            return user;
        }
        */

        /*
        public async Task<List<UserProfile>> GetAllUsers()
        {
            return _users.Values.ToList();
        }
        */

        /*
        public async Task<List<UserProfile>> GetOnlineUsers()
        {
            var now = DateTime.UtcNow;
            return _users.Values
                .Where(u => u.IsOnline && (now - u.LastSeen).TotalMinutes < 2)
                .ToList();
        }
        */

        /*
        public async Task<bool> UpdateUserProfile(string userId, string name, string avatar, string color)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.Name = name;
                user.Avatar = avatar;
                user.Color = color;
                return true;
            }
            return false;
        }
        */

        // === Приватные чаты ===

        /*
        public async Task<string> GetOrCreatePrivateChat(string user1Id, string user2Id)
        {
            if (user1Id == user2Id)
                throw new Exception("Нельзя создать чат с самим собой");

            // Проверяем, существует ли уже чат
            var existing = _chats.Values.FirstOrDefault(c =>
                (c.User1Id == user1Id && c.User2Id == user2Id) ||
                (c.User1Id == user2Id && c.User2Id == user1Id));

            if (existing != null)
            {
                existing.LastActivity = DateTime.UtcNow;
                return existing.Id;
            }

            var chatId = $"priv_{Guid.NewGuid().ToString().Substring(0, 8)}";
            var chat = new PrivateChatRoom
            {
                Id = chatId,
                User1Id = user1Id,
                User2Id = user2Id,
                Messages = new List<Models.PrivateMessage>(),
                CreatedAt = DateTime.UtcNow,
                LastActivity = DateTime.UtcNow,
                IsActive = true
            };

            _chats.TryAdd(chatId, chat);
            return chatId;
        }
        */

        /*
        public async Task<List<PrivateChatRoom>> GetUserChats(string userId)
        {
            return _chats.Values
                .Where(c => c.User1Id == userId || c.User2Id == userId)
                .OrderByDescending(c => c.LastActivity)
                .ToList();
        }
        */

        /*
        public async Task<PrivateMessage> SendPrivateMessage(string chatId, string senderId, string receiverId, string content, string replyToId = null)
        {
            if (!_chats.TryGetValue(chatId, out var chat))
            {
                throw new Exception("Чат не найден");
            }

            // Проверяем, не заблокирован ли пользователь
            var sender = await GetUserAsync(senderId);
            var receiver = await GetUserAsync(receiverId);
            var isBlocked = receiver?.BlockedUsers?.Any(bl => bl.UserId == senderId);
            if (isBlocked == true)
            {
                throw new Exception("Пользователь заблокировал вас");
            }

            // Проверяем, не заглушен ли пользователь
            if (await IsUserMuted(senderId))
            {
                throw new Exception("Вы временно заблокированы");
            }

            var message = new PrivateMessage
            {
                Id = Guid.NewGuid().ToString(),
                ChatId = chatId,
                SenderId = senderId,
                SenderName = sender?.Name ?? "Unknown",
                SenderAvatar = sender?.Avatar ?? "👤",
                ReceiverId = receiverId,
                Content = content,
                Timestamp = DateTime.UtcNow,
                IsRead = false,
                ReplyToId = replyToId,
                Attachments = new List<FileAttachment>(),
                IsEdited = false
            };

            chat.Messages.Add(message);
            chat.LastActivity = DateTime.UtcNow;
            chat.LastMessage = content;
            chat.LastMessageAt = DateTime.UtcNow;

            // Увеличиваем счетчик непрочитанных
            if (_users.TryGetValue(receiverId, out var receiverUser))
            {
                receiverUser.UnreadCount = (receiverUser?.UnreadCount ?? 0) + 1;
            }

            // Увеличиваем счетчик сообщений отправителя
            if (sender != null)
            {
                sender.MessageCount = (sender?.MessageCount ?? 0) + 1;
                sender.LastMessageAt = DateTime.UtcNow;
            }

            return message;
        }
        */
        /*
        public async Task<List<PrivateMessage>> GetPrivateMessages(string chatId, int limit = 50, int offset = 0)
        {
            if (!_chats.TryGetValue(chatId, out var chat))
            {
                return new List<PrivateMessage>();
            }

            return chat.Messages
                .OrderByDescending(m => m.Timestamp)
                .Skip(offset)
                .Take(limit)
                .Reverse()
                .ToList();
        }
        */
        /*
        public async Task<bool> MarkMessagesAsRead(string chatId, string userId)
        {
            if (!_chats.TryGetValue(chatId, out var chat))
            {
                return false;
            }

            var unread = chat.Messages
                .Where(m => m.ReceiverId == userId && !m.IsRead);

            foreach (var msg in unread)
            {
                msg.IsRead = true;
                msg.ReadAt = DateTime.UtcNow;
            }

            // Сбрасываем счетчик непрочитанных
            if (_users.TryGetValue(userId, out var user))
            {
                user.UnreadCount = 0;
            }

            return true;
        }
        */

        /*
        public async Task<bool> DeletePrivateMessage(string messageId, string userId)
        {
            foreach (var chat in _chats.Values)
            {
                var msg = chat.Messages.FirstOrDefault(m => m.Id == messageId);
                if (msg != null && msg.SenderId == userId)
                {
                    chat.Messages.Remove(msg);
                    return true;
                }
            }
            return false;
        }
        */
        /*
        public async Task<bool> EditPrivateMessage(string messageId, string userId, string newContent)
        {
            foreach (var chat in _chats.Values)
            {
                var msg = chat.Messages.FirstOrDefault(m => m.Id == messageId);
                if (msg != null && msg.SenderId == userId)
                {
                    msg.Content = newContent;
                    msg.IsEdited = true;
                    msg.EditedAt = DateTime.UtcNow;
                    return true;
                }
            }
            return false;
        }
        */

        /*
        public async Task<int> GetUnreadCount(string userId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                return user?.UnreadCount ?? 0;
            }
            return 0;
        }
        */
        // === Heartbeat ===
        /*
        public async Task<bool> UpdateHeartbeat(string userId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.LastSeen = DateTime.UtcNow;
                user.IsOnline = true;
                _userHeartbeats[userId] = DateTime.UtcNow;
                return true;
            }
            return false;
        }
        */

        /*
        public async Task CheckInactiveUsers()
        {
            var now = DateTime.UtcNow;
            var inactive = _users.Values
                .Where(u => u.IsOnline && (now - u.LastSeen).TotalMinutes > 5);

            foreach (var user in inactive)
            {
                user.IsOnline = false;
                user.Status = "offline";
            }
        }
        */

        // === Блокировка и модерация ===

        /*
        public async Task<bool> BlockUser(string userId, string blockUserId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                if (!user.BlockedUsers.Contains(blockUserId))
                {
                    user.BlockedUsers.Add(blockUserId);
                }
                return true;
            }
            return false;
        }
        */

        /*
        public async Task<bool> UnblockUser(string userId, string blockUserId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.BlockedUsers.Remove(blockUserId);
                return true;
            }
            return false;
        }
        */

        /*
        public async Task<List<string>> GetBlockedUsers(string userId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                return user.BlockedUsers ?? new List<string>();
            }
            return new List<string>();
        }
        */

        /*
        public async Task<bool> MuteUser(string userId, int minutes, string moderatorId = null, string reason = null)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.MutedUntil = DateTime.UtcNow.AddMinutes(minutes);

                // Логируем действие
                if (moderatorId != null)
                {
                    await LogModerationAction(moderatorId, userId, "mute", reason, minutes);
                }
                return true;
            }
            return false;
        }
        */

        /*
        public async Task<bool> IsUserMuted(string userId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                if (user.MutedUntil.HasValue && user.MutedUntil.Value > DateTime.UtcNow)
                {
                    return true;
                }
                // Сбрасываем истекший мут
                user.MutedUntil = null;
            }
            return false;
        }
        */

        /*
        public async Task<bool> BanUser(string userId, string moderatorId = null, string reason = null)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.IsOnline = false;
                user.Status = "banned";
                user.BanReason = reason;
                user.BannedAt = DateTime.UtcNow;

                if (moderatorId != null)
                {
                    await LogModerationAction(moderatorId, userId, "ban", reason);
                }
                return true;
            }
            return false;
        }
        */

        /*
        public async Task<bool> UnbanUser(string userId, string moderatorId = null)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.Status = "offline";
                user.BanReason = null;
                user.BannedAt = null;

                if (moderatorId != null)
                {
                    await LogModerationAction(moderatorId, userId, "unban");
                }
                return true;
            }
            return false;
        }
        */

        /*
        public async Task<bool> IsUserBanned(string userId)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                return user.Status == "banned" || user.BannedAt.HasValue;
            }
            return false;
        }
        */

        /*
        public async Task<bool> KickUser(string userId, string roomId, string moderatorId = null)
        {
            if (_users.TryGetValue(userId, out var user))
            {
                user.Rooms?.Remove(roomId);

                if (moderatorId != null)
                {
                    await LogModerationAction(moderatorId, userId, "kick");
                }
                return true;
            }
            return false;
        }
        */
        // === Модерация ===
        /*
        public async Task LogModerationAction(string moderatorId, string targetUserId, string action, string reason = null, int durationMinutes = 0)
        {
            var moderator = await GetUserAsync(moderatorId);
            var target = await GetUserAsync(targetUserId);

            var logEntry = new ModerationAction
            {
                Id = Guid.NewGuid().ToString(),
                ModeratorId = moderatorId,
                ModeratorName = moderator?.Name ?? "Unknown",
                TargetUserId = targetUserId,
                TargetUserName = target?.Name ?? "Unknown",
                Action = action,
                Reason = reason,
                Timestamp = DateTime.UtcNow,
                DurationMinutes = durationMinutes
            };

            if (!_moderationLog.ContainsKey(moderatorId))
            {
                _moderationLog[moderatorId] = new List<ModerationAction>();
            }
            _moderationLog[moderatorId].Add(logEntry);
        }

        public async Task<List<ModerationAction>> GetModerationLog(string userId = null)
        {
            if (userId != null && _moderationLog.TryGetValue(userId, out var logs))
            {
                return logs.OrderByDescending(l => l.Timestamp).ToList();
            }
            return _moderationLog.Values.SelectMany(l => l).OrderByDescending(l => l.Timestamp).ToList();
        }
        */
        // === Статистика ===
        /*
        public async Task<AdminStats> GetStats()
        {
            var now = DateTime.UtcNow;
            var onlineUsers = _users.Values.Count(u => u.IsOnline && (now - u.LastSeen).TotalMinutes < 2);
            var bannedUsers = _users.Values.Count(u => u.Status == "banned");
            var mutedUsers = _users.Values.Count(u => u.MutedUntil.HasValue && u.MutedUntil.Value > now);
            var totalMessages = _chats.Values.Sum(c => c.Messages?.Count ?? 0);
            var privateMessages = _chats.Values.Sum(c => c.Messages?.Count(m => !string.IsNullOrEmpty(m.Content)) ?? 0);

            return new AdminStats
            {
                TotalUsers = _users.Count,
                OnlineUsers = onlineUsers,
                TotalRooms = _chats.Count,
                TotalMessages = totalMessages,
                PrivateMessages = privateMessages,
                Uptime = DateTime.UtcNow,
                BannedUsers = bannedUsers,
                MutedUsers = mutedUsers
            };
        }
        */

    }
}