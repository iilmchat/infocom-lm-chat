// Services/BotService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис для работы с ботами
    /// </summary>
    public class BotService
    {
        private readonly ChatDbContext _context;
        private readonly RoomManager _roomManager;
        private readonly ILogger<BotService> _logger;

        public BotService(ChatDbContext context, RoomManager roomManager, ILogger<BotService> logger)
        {
            _context = context;
            _roomManager = roomManager;
            _logger = logger;
        }

        /// <summary>
        /// Проверка API-ключа и получение бота
        /// </summary>
        public async Task<BotAccount> ValidateApiKeyAsync(string apiKey)
        {
            try
            {
                return await _context.BotAccounts
                    .FirstOrDefaultAsync(b => b.ApiKey == apiKey && b.IsActive);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка валидации API-ключа");
                return null;
            }
        }

        /// <summary>
        /// Отправка сообщения от имени бота
        /// </summary>
        public async Task<ChatMessage> SendBotMessageAsync(string apiKey, string roomId, string content, string replyToId = null)
        {
            try
            {
                var bot = await ValidateApiKeyAsync(apiKey);
                if (bot == null)
                    throw new UnauthorizedAccessException("Недействительный API-ключ");

                var message = new ChatMessage
                {
                    Id = Guid.NewGuid().ToString(),
                    RoomId = roomId,
                    UserId = bot.BotId,
                    UserName = bot.Name,
                    UserAvatar = bot.Avatar ?? "🤖",
                    Role = "assistant",
                    Content = content,
                    Timestamp = DateTime.UtcNow,
                    ReplyToId = replyToId,
                    Model = "bot"
                };

                var result = await _roomManager.AddMessageAsync(roomId, message);
                if (!result)
                    throw new Exception("Не удалось отправить сообщение");

                return message;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка отправки сообщения ботом в комнату {roomId}");
                throw;
            }
        }

        /// <summary>
        /// Создание нового бота
        /// </summary>
        public async Task<BotAccount> CreateBotAsync(string name, string ownerId, string avatar = "🤖")
        {
            try
            {
                var bot = new BotAccount
                {
                    Name = name,
                    Avatar = avatar,
                    OwnerId = ownerId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                await _context.BotAccounts.AddAsync(bot);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Создан бот {name} (ID: {bot.BotId})");
                return bot;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка создания бота {name}");
                throw;
            }
        }

        /// <summary>
        /// Получение списка ботов пользователя
        /// </summary>
        public async Task<List<BotAccountDto>> GetUserBotsAsync(string userId)
        {
            try
            {
                var bots = await _context.BotAccounts
                    .Where(b => b.OwnerId == userId && b.IsActive)
                    .ToListAsync();

                return bots.Select(b => new BotAccountDto
                {
                    BotId = b.BotId,
                    Name = b.Name,
                    Avatar = b.Avatar,
                    ApiKey = b.ApiKey,
                    IsActive = b.IsActive,
                    CreatedAt = b.CreatedAt,
                    OwnerId = b.OwnerId
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения ботов пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Вход бота в комнату
        /// </summary>
        public async Task<bool> JoinRoomAsync(string apiKey, string roomId)
        {
            try
            {
                var bot = await ValidateApiKeyAsync(apiKey);
                if (bot == null)
                    throw new UnauthorizedAccessException("Недействительный API-ключ");

                var userInfo = new UserInfo
                {
                    Id = bot.BotId,
                    Name = bot.Name,
                    Avatar = bot.Avatar ?? "🤖",
                    AvatarType = "emoji",
                    AvatarData = "",
                    Color = "#888888",
                    Role = "bot"
                };

                return await _roomManager.AddUserToRoomAsync(roomId, userInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка входа бота в комнату {roomId}");
                throw;
            }
        }

        /// <summary>
        /// Получение комнат, где присутствует бот
        /// </summary>
        public async Task<List<string>> GetBotRoomsAsync(string botId)
        {
            try
            {
                var userRooms = await _context.UserRooms
                    .Where(ur => ur.UserId == botId && ur.IsActive)
                    .Select(ur => ur.RoomId)
                    .ToListAsync();

                return userRooms;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения комнат бота {botId}");
                throw;
            }
        }
    }
}