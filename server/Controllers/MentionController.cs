// Controllers/MentionController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MentionController : ControllerBase
    {
        private readonly MentionService _mentionService;
        private readonly ILogger<MentionController> _logger;

        public MentionController(MentionService mentionService, ILogger<MentionController> logger)
        {
            _mentionService = mentionService;
            _logger = logger;
        }

        [HttpGet("unread/{userId}")]
        public async Task<IActionResult> GetUnreadMentions(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var mentions = await _mentionService.GetUnreadMentionsAsync(userId);
                var count = await _mentionService.GetUnreadMentionsCountAsync(userId);

                return Ok(new { 
                    success = true, 
                    mentions,
                    unreadCount = count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения упоминаний для {userId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkMentionsAsRead([FromBody] MarkMentionsReadRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.UserId))
                    return BadRequest(new { error = "UserId обязателен" });

                var result = await _mentionService.MarkMentionsAsReadAsync(
                    request.UserId,
                    request.MentionIds
                );

                if (result)
                {
                    var count = await _mentionService.GetUnreadMentionsCountAsync(request.UserId);
                    return Ok(new { 
                        success = true, 
                        unreadCount = count
                    });
                }

                return BadRequest(new { error = "Не удалось отметить упоминания как прочитанные" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка отметки упоминаний как прочитанных");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpGet("count/{userId}")]
        public async Task<IActionResult> GetUnreadCount(string userId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                    return BadRequest(new { error = "UserId обязателен" });

                var count = await _mentionService.GetUnreadMentionsCountAsync(userId);
                return Ok(new { success = true, unreadCount = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения количества упоминаний для {userId}");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }

        [HttpPost("extract")]
        public IActionResult ExtractMentions([FromBody] ExtractMentionsRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Text))
                    return Ok(new { success = true, mentions = new List<string>() });

                var mentions = _mentionService.ExtractMentions(request.Text);
                return Ok(new { success = true, mentions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка извлечения упоминаний");
                return StatusCode(500, new { error = "Внутренняя ошибка сервера" });
            }
        }
    }

    public class MarkMentionsReadRequest
    {
        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        public List<string> MentionIds { get; set; }
    }

    public class ExtractMentionsRequest
    {
        [Required]
        public string Text { get; set; }
    }
}