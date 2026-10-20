// Controllers/ReactionController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using System.ComponentModel.DataAnnotations;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReactionController : ControllerBase
    {
        private readonly ReactionService _reactionService;
        private readonly ILogger<ReactionController> _logger;

        public ReactionController(ReactionService reactionService, ILogger<ReactionController> logger)
        {
            _reactionService = reactionService;
            _logger = logger;
        }

        [HttpPost("add")]
        public async Task<IActionResult> AddReaction([FromBody] AddReactionRequest request)
        {
            try
            {
                if (request == null)
                    return BadRequest(new { error = "Пустой запрос" });

                if (string.IsNullOrWhiteSpace(request.MessageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                if (string.IsNullOrWhiteSpace(request.Reaction))
                    return BadRequest(new { error = "Reaction обязателен" });

                if (!ReactionTypes.IsValid(request.Reaction))
                    return BadRequest(new { error = "Недопустимая реакция" });

                var result = await _reactionService.AddReactionAsync(
                    request.MessageId,
                    request.UserId,
                    request.Reaction
                );

                if (result)
                {
                    var reactions = await _reactionService.GetReactionsAsync(request.MessageId);
                    return Ok(new { 
                        success = true, 
                        reactions,
                        userReaction = request.Reaction
                    });
                }

                return BadRequest(new { error = "Не удалось добавить реакцию" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка добавления реакции");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        //HttpDelete
        [HttpDelete("remove")]
        public async Task<IActionResult> RemoveReaction_delete([FromQuery] string messageId, [FromQuery] string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _reactionService.RemoveReactionAsync(messageId, userId);

                if (result)
                {
                    var reactions = await _reactionService.GetReactionsAsync(messageId);
                    return Ok(new
                    {
                        success = true,
                        reactions,
                        userReaction = (string)null
                    });
                }

                return BadRequest(new { error = "Не удалось удалить реакцию" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка удаления реакции");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpPost("remove")]
        public async Task<IActionResult> RemoveReaction([FromQuery] string messageId, [FromQuery] string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _reactionService.RemoveReactionAsync(messageId, userId);

                if (result)
                {
                    var reactions = await _reactionService.GetReactionsAsync(messageId);
                    return Ok(new { 
                        success = true, 
                        reactions,
                        userReaction = (string)null
                    });
                }

                return BadRequest(new { error = "Не удалось удалить реакцию" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка удаления реакции");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpGet("message/{messageId}")]
        public async Task<IActionResult> GetReactions(string messageId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                var reactions = await _reactionService.GetReactionsAsync(messageId);
                return Ok(new { success = true, reactions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения реакций для сообщения {messageId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpGet("message/{messageId}/user/{userId}")]
        public async Task<IActionResult> GetUserReaction(string messageId, string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(messageId))
                    return BadRequest(new { error = "MessageId обязателен" });

                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var reaction = await _reactionService.GetUserReactionAsync(messageId, userId);
                return Ok(new { success = true, userReaction = reaction });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения реакции пользователя");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }
    }

    public class AddReactionRequest
    {
        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        [Required]
        [MaxLength(10)]
        public string Reaction { get; set; }
    }
}