// Controllers/BotController.cs

using System;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    /// <summary>
    /// Контроллер для интеграции ботов
    /// </summary>
    [ApiController]
    [Route("api/bot")]
    public class BotController : ControllerBase
    {
        private readonly BotService _botService;
        private readonly ILogger<BotController> _logger;

        public BotController(BotService botService, ILogger<BotController> logger)
        {
            _botService = botService;
            _logger = logger;
        }

        /// <summary>
        /// Отправка сообщения от бота
        /// </summary>
        [HttpPost("message")]
        public async Task<IActionResult> SendBotMessage([FromBody] BotMessageRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.ApiKey))
                    return BadRequest(new { error = "ApiKey обязателен" });

                if (string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                if (string.IsNullOrWhiteSpace(request.Content))
                    return BadRequest(new { error = "Content обязателен" });

                var message = await _botService.SendBotMessageAsync(request.ApiKey, request.RoomId, request.Content, request.ReplyToId);

                return Ok(new
                {
                    success = true,
                    message = new
                    {
                        message.Id,
                        message.UserId,
                        message.UserName,
                        message.Content,
                        message.Timestamp
                    }
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { error = "Недействительный API-ключ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отправки сообщения ботом");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Получение комнат, где есть бот
        /// </summary>
        [HttpGet("rooms")]
        public async Task<IActionResult> GetBotRooms([FromQuery] string apiKey)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(apiKey))
                    return BadRequest(new { error = "ApiKey обязателен" });

                var bot = await _botService.ValidateApiKeyAsync(apiKey);
                if (bot == null)
                    return Unauthorized(new { error = "Недействительный API-ключ" });

                var rooms = await _botService.GetBotRoomsAsync(bot.BotId);
                return Ok(new { success = true, rooms });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения комнат бота");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Вход бота в комнату
        /// </summary>
        [HttpPost("join")]
        public async Task<IActionResult> BotJoinRoom([FromBody] BotJoinRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.ApiKey))
                    return BadRequest(new { error = "ApiKey обязателен" });

                if (string.IsNullOrWhiteSpace(request.RoomId))
                    return BadRequest(new { error = "RoomId обязателен" });

                var result = await _botService.JoinRoomAsync(request.ApiKey, request.RoomId);
                return Ok(new { success = result });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { error = "Недействительный API-ключ" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка входа бота в комнату");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}