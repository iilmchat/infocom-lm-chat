using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using InfocomChat.Server.Models;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис отслеживания присутствия пользователей
    /// </summary>
    public class UserPresenceService
    {
        private readonly RoomManager _roomManager;
        private readonly UserService _userService;
        private readonly ConcurrentDictionary<string, UserPresence> _users = new ConcurrentDictionary<string, UserPresence>();
        private readonly ConcurrentDictionary<string, HashSet<string>> _roomUsers = new ConcurrentDictionary<string, HashSet<string>>();
        private readonly ConcurrentDictionary<string, DateTime> _typingStatus = new ConcurrentDictionary<string, DateTime>();
        private readonly TimeSpan _typingTimeout = TimeSpan.FromSeconds(3);
        private readonly TimeSpan _inactiveTimeout = TimeSpan.FromMinutes(5);

        public UserPresenceService(
            RoomManager roomManager,
            UserService userService)
        {
            _roomManager = roomManager;
            _userService = userService;
        }
        /// <summary>
        /// Обновление активности пользователя
        /// </summary>
        public async Task UpdateUserActivityAsync(string userId, string roomId)
        {
            var presence = _users.GetOrAdd(userId, new UserPresence
            {
                UserId = userId,
                LastSeen = DateTime.UtcNow,
                Status = UserStatus.Online
            });

            presence.LastSeen = DateTime.UtcNow;
            presence.RoomId = roomId;

            // Добавляем пользователя в комнату
            _roomUsers.AddOrUpdate(
                roomId,
                new HashSet<string> { userId },
                (_, set) => { set.Add(userId); return set; }
            );

            await Task.CompletedTask;
        }

        /// <summary>
        /// Обновление статуса печатания
        /// </summary>
        public async Task SetTypingStatusAsync(string userId, string roomId, bool isTyping)
        {
            var key = $"{roomId}:{userId}";
            
            if (isTyping)
            {
                _typingStatus[key] = DateTime.UtcNow;
            }
            else
            {
                _typingStatus.TryRemove(key, out _);
            }

            // Обновляем статус в информации о пользователе
            if (_users.TryGetValue(userId, out var presence))
            {
                presence.IsTyping = isTyping;
            }

            await Task.CompletedTask;
        }

        /// <summary>
        /// Проверка, печатает ли пользователь
        /// </summary>
        public async Task<bool> IsUserTypingAsync(string userId, string roomId)
        {
            var key = $"{roomId}:{userId}";
            if (await _roomManager.AddUserIdToRoomAsync(roomId, userId))
            { 
                if (_typingStatus.TryGetValue(key, out var lastTypingTime))
                {
                    // Если прошло больше 3 секунд, считаем что пользователь перестал печатать
                    if (DateTime.UtcNow - lastTypingTime < _typingTimeout)
                    {
                        return true;
                    }
                    else
                    {
                        // Автоматически сбрасываем статус
                        _typingStatus.TryRemove(key, out _);
                    }
                }

                return false;
            }
            else
            {
                return false;
            }
        }

        /// <summary>
        /// Получение списка активных пользователей в комнате
        /// </summary>
        public async Task<List<UserInfo>> GetActiveUsersInRoomAsync(string roomId)
        {
            var activeUsers = new List<UserInfo>();
            
            if (_roomUsers.TryGetValue(roomId, out var userIds))
            {
                foreach (var userId in userIds)
                {
                    if (_users.TryGetValue(userId, out var presence))
                    {
                        // Проверяем, активен ли пользователь
                        if (DateTime.UtcNow - presence.LastSeen < _inactiveTimeout)
                        {
                            // Проверяем статус печатания
                            var isTyping = await IsUserTypingAsync(userId, roomId);
                            
                            activeUsers.Add(new UserInfo
                            {
                                Id = presence.UserId,
                                Name = presence.Name ?? userId,
                                Avatar = presence.Avatar ?? "👤",
                                AvatarType = presence.AvatarType ?? "emoji",
                                AvatarData = presence.AvatarData ?? "",
                                Color = presence.Color ?? "#7ec8e3",
                                IsTyping = isTyping,
                                LastSeen = presence.LastSeen,
                                Status = presence.Status.ToString().ToLower()
                            });
                        }
                    }
                }
            }

            return activeUsers;
        }

        /// <summary>
        /// Получение всех активных пользователей
        /// </summary>
        public async Task<List<UserInfo>> GetAllActiveUsersAsync()
        {
            var activeUsers = new List<UserInfo>();
            var now = DateTime.UtcNow;

            foreach (var kvp in _users)
            {
                var presence = kvp.Value;
                if (now - presence.LastSeen < _inactiveTimeout)
                {
                    var isTyping = await IsUserTypingAsync(presence.UserId, presence.RoomId);
                    
                    activeUsers.Add(new UserInfo
                    {
                        Id = presence.UserId,
                        Name = presence.Name ?? presence.UserId,
                        Avatar = presence.Avatar ?? "👤",
                        AvatarType = presence.AvatarType ?? "emoji",
                        AvatarData = presence.AvatarData ?? "",
                        Color = presence.Color ?? "#7ec8e3",
                        IsTyping = isTyping,
                        LastSeen = presence.LastSeen,
                        RoomId = presence.RoomId,
                        Status = presence.Status.ToString().ToLower()
                    });
                }
            }

            return activeUsers;
        }

        /// <summary>
        /// Удаление пользователя из комнаты
        /// </summary>
        public async Task RemoveUserFromRoomAsync(string userId, string roomId)
        {
            if (_roomUsers.TryGetValue(roomId, out var users))
            {
                users.Remove(userId);
                
                if (users.Count == 0)
                {
                    _roomUsers.TryRemove(roomId, out _);
                }
            }

            // Удаляем статус печатания
            var typingKey = $"{roomId}:{userId}";
            _typingStatus.TryRemove(typingKey, out _);

            // Обновляем статус пользователя
            if (_users.TryGetValue(userId, out var presence))
            {
                presence.Status = UserStatus.Offline;
                presence.RoomId = null;
            }

            await Task.CompletedTask;
        }

        /// <summary>
        /// Получение количества пользователей в комнате
        /// </summary>
        public async Task<int> GetUserCountInRoomAsync(string roomId)
        {
            var roomUsers = await _roomManager.GetRoomUsersAsync(roomId);
            if (roomUsers.Count>0)
            {
                var activeCount = roomUsers.Count;
                return activeCount;
            }
            return 0;
            /*
            if (_roomUsers.TryGetValue(roomId, out var users))
            {
                var activeCount = 0;
                foreach (var userId in users)
                {
                    if (_users.TryGetValue(userId, out var presence))
                    {
                        if (DateTime.UtcNow - presence.LastSeen < _inactiveTimeout)
                        {
                            activeCount++;
                        }
                    }
                }
                return activeCount;
            }
            return 0;
            */
        }

        /// <summary>
        /// Обновление информации о пользователе
        /// </summary>
        public async Task UpdateUserInfoAsync(string userId, string name, string avatar, string color)
        {
            var presence = _users.GetOrAdd(userId, new UserPresence
            {
                UserId = userId,
                LastSeen = DateTime.UtcNow,
                Status = UserStatus.Online
            });

            if (!string.IsNullOrEmpty(name))
                presence.Name = name;
            
            if (!string.IsNullOrEmpty(avatar))
                presence.Avatar = avatar;
            
            if (!string.IsNullOrEmpty(color))
                presence.Color = color;

            await Task.CompletedTask;
        }

        /// <summary>
        /// Очистка неактивных пользователей (для поддержания производительности)
        /// </summary>
        public async Task CleanupInactiveUsersAsync()
        {
            var now = DateTime.UtcNow;
            var inactiveUsers = new List<string>();

            foreach (var kvp in _users)
            {
                var presence = kvp.Value;
                if (now - presence.LastSeen > _inactiveTimeout)
                {
                    inactiveUsers.Add(kvp.Key);
                }
            }

            foreach (var userId in inactiveUsers)
            {
                _users.TryRemove(userId, out _);
                
                // Удаляем из всех комнат
                foreach (var roomKvp in _roomUsers)
                {
                    roomKvp.Value.Remove(userId);
                }
            }

            // Очищаем пустые комнаты
            var emptyRooms = _roomUsers
                .Where(kvp => kvp.Value.Count == 0)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var roomId in emptyRooms)
            {
                _roomUsers.TryRemove(roomId, out _);
            }

            await Task.CompletedTask;
        }

        /// <summary>
        /// Получение статуса пользователя
        /// </summary>
        public async Task<UserPresence> GetUserPresenceAsync(string userId)
        {
            _users.TryGetValue(userId, out var presence);
            return await Task.FromResult(presence);
        }

        /// <summary>
        /// Проверка, активен ли пользователь
        /// </summary>
        public async Task<bool> IsUserActiveAsync(string userId)
        {
            var users = await _userService.GetActiveUsersAsync(10);
            if (users.Exists(u => u.Id == userId))
            {
                return true;
            }
            /*
            if (_users.TryGetValue(userId, out var presence))
            {
                return DateTime.UtcNow - presence.LastSeen < _inactiveTimeout;
            }
            */
            return false;
        }
    }

    /// <summary>
    /// Состояние присутствия пользователя
    /// </summary>
    public class UserPresence
    {
        public string UserId { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string AvatarType { get; set; }
        public string AvatarData { get; set; }
        public string Color { get; set; }
        public bool IsTyping { get; set; }
        public DateTime LastSeen { get; set; }
        public string RoomId { get; set; }
        public UserStatus Status { get; set; }
    }

    /// <summary>
    /// Статус пользователя
    /// </summary>
    public enum UserStatus
    {
        Online,
        Away,
        Offline,
        Busy
    }
}