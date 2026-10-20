// Services/MessageHistoryService.cs
using System;
//using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models;
//using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Services
{
    public class MessageHistoryService
    {
        //private readonly ConcurrentDictionary<string, List<ChatMessage>> _history = new ConcurrentDictionary<string, List<ChatMessage>>();
        //private readonly IMemoryCache _cache;
        private readonly ChatDbContext _context;        
        private readonly int _maxHistory = 1000;

        // Кэш для быстрого доступа к последним сообщениям
        private readonly Dictionary<string, List<ChatMessage>> _cache = new Dictionary<string, List<ChatMessage>>();
        private readonly object _cacheLock = new object();

        public MessageHistoryService(ChatDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Создание истории для комнаты (инициализация кэша)
        /// </summary>
        public async Task CreateRoomHistoryAsync(string roomId)
        {
            lock (_cacheLock)
            {
                if (!_cache.ContainsKey(roomId))
                {
                    _cache[roomId] = new List<ChatMessage>();
                }
            }
            await Task.CompletedTask;
        }

        /// <summary>
        /// Добавление сообщения в историю
        /// </summary>
        public async Task AddMessageAsync(string roomId, ChatMessage message)
        {
            lock (_cacheLock)
            {
                if (!_cache.TryGetValue(roomId, out var messages))
            {
                messages = new List<ChatMessage>();
                    _cache[roomId] = messages;
            }

                messages.Add(message);
                
                // Ограничиваем кэш
                if (messages.Count > _maxHistory)
                {
                    messages.RemoveRange(0, messages.Count - _maxHistory);
                }
            }

            await Task.CompletedTask;
        }

        /// <summary>
        /// Получение сообщения по ID
        /// </summary>
        public async Task<ChatMessage> GetMessageAsync(string roomId, string messageId)
        {
            // Сначала проверяем кэш
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages))
            {
                    var cached = messages.FirstOrDefault(m => m.Id == messageId);
                    if (cached != null)
                        return cached;
                }
            }

            // Ищем в БД
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.RoomId == roomId);

            if (message == null)
            return null;

            return MapToChatMessage(message);
        }

        /// <summary>
        /// Обновление сообщения
        /// </summary>
        public async Task<bool> UpdateMessageAsync(string roomId, string messageId, string newContent)
        {
            // Обновляем в кэше
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages))
                {
                    var msg = messages.FirstOrDefault(m => m.Id == messageId);
                    if (msg != null)
                    {
                        msg.Content = newContent;
                        msg.IsEdited = true;
                        return true;
                    }
                }
            }

            // Обновляем в БД
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.RoomId == roomId);

            if (message == null)
            return false;

            message.Content = newContent;
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Удаление сообщения
        /// </summary>
        public async Task<bool> DeleteMessageAsync(string roomId, string messageId)
        {
            // Удаляем из кэша
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages))
                {
                    var msg = messages.FirstOrDefault(m => m.Id == messageId);
                    if (msg != null)
                    {
                        messages.Remove(msg);
                        return true;
                    }
                }
            }

            // Удаляем из БД
            var message = await _context.Messages
                .FirstOrDefaultAsync(m => m.MessageId == messageId && m.RoomId == roomId);

            if (message == null)
            return false;

            _context.Messages.Remove(message);
            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Получение количества сообщений
        /// </summary>
        public async Task<int> GetMessageCountAsync(string roomId)
        {
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages))
                {
                    return messages.Count;
                }
            }

            return await _context.Messages
                .CountAsync(m => m.RoomId == roomId);
        }

        /// <summary>
        /// Получение истории с пагинацией
        /// </summary>
        public async Task<List<ChatMessage>> GetHistoryAsync(string roomId, int limit = 100, int offset = 0)
        {
            // Проверяем кэш для быстрого доступа
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages) && messages.Count >= offset + limit)
                {
                    return messages
                        .OrderByDescending(m => m.Timestamp)
                        .Skip(offset)
                        .Take(limit)
                        .Reverse()
                        .ToList();
                }
            }

            // Загружаем из БД
            var dbMessages = await _context.Messages
                .Where(m => m.RoomId == roomId)
                .OrderByDescending(m => m.Timestamp)
                .Skip(offset)
                .Take(limit)
                .OrderBy(m => m.Timestamp)
                .ToListAsync();

            var result = dbMessages.Select(MapToChatMessage).ToList();

            // Обновляем кэш
            lock (_cacheLock)
            {
                if (!_cache.TryGetValue(roomId, out var cached))
                {
                    cached = new List<ChatMessage>();
                    _cache[roomId] = cached;
                }

                // Добавляем только новые сообщения
                foreach (var msg in result)
                {
                    if (!cached.Any(m => m.Id == msg.Id))
                    {
                        cached.Add(msg);
                    }
                }

                // Ограничиваем кэш
                if (cached.Count > _maxHistory)
                {
                    cached.RemoveRange(0, cached.Count - _maxHistory);
                }
            }

            return result;
        }

        /*
        //УДАЛЕНо СТАРЬЕ
        public async Task<List<ChatMessage>> GetHistoryAsync(string roomId, int limit = 100, int offset = 0)
        {
            if (_history.TryGetValue(roomId, out var messages))
            {
                lock (messages)
                {
                    return messages
                        .OrderByDescending(m => m.Timestamp)
                        .Skip(offset)
                        .Take(limit)
                        .Reverse()
                        .ToList();
                }
            }
            return new List<ChatMessage>();
        }
        */

        /// <summary>
        /// Очистка истории комнаты
        /// </summary>
        public async Task ClearHistoryAsync(string roomId)
        {
            lock (_cacheLock)
            {
                if (_cache.TryGetValue(roomId, out var messages))
                {
                    messages.Clear();
                }
            }

            // Удаляем из БД
            var messagesToDelete = await _context.Messages
                .Where(m => m.RoomId == roomId)
                .ToListAsync();

            if (messagesToDelete.Any())
            {
                _context.Messages.RemoveRange(messagesToDelete);
                await _context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Загрузка истории в кэш при старте
        /// </summary>
        public async Task LoadHistoryToCacheAsync(string roomId, int limit = 100)
        {
            var messages = await _context.Messages
                .Where(m => m.RoomId == roomId)
                .OrderByDescending(m => m.Timestamp)
                .Take(limit)
                .OrderBy(m => m.Timestamp)
                .ToListAsync();

            lock (_cacheLock)
            {
                _cache[roomId] = messages.Select(MapToChatMessage).ToList();
            }
        }

        /// <summary>
        /// Маппинг из Entity в ChatMessage
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
    }
}