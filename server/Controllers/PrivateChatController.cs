// Controllers/PrivateChatController.cs
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;
using InfocomChat.Server.Services;
using InfocomChat.Server.Models;
using System.Collections.Generic;
using System.Linq;

namespace InfocomChat.Server.Controllers
{
    [ApiController]
    [Route("api/private")]
    public class PrivateChatController : ControllerBase
    {
        private readonly PrivateChatService _privateChatService;
        private readonly UserPresenceService _presenceService;

        public PrivateChatController(
            PrivateChatService privateChatService,
            UserPresenceService presenceService)
        {
            _privateChatService = privateChatService;
            _presenceService = presenceService;
        }

        // === Профиль пользователя ===

        [HttpPost("user")]
        public async Task<IActionResult> GetOrCreateUser([FromBody] UserProfileRequest request)
        {
            try
            {
                var user = await _privateChatService.GetOrCreateUserAsync(
                    request.UserId,
                    request.Name,
                    request.Avatar,
                    request.Color,
                    request.AvatarType,
                    request.AvatarData
                );

                return Ok(new { success = true, user });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUser(string userId)
        {
            try
            {
                var user = await _privateChatService.GetUserAsync(userId);
                if (user == null)
                    return NotFound(new { error = "Пользователь не найден" });

                return Ok(new { success = true, user });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var users = await _privateChatService.GetAllUsersAsync();
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("users/online")]
        public async Task<IActionResult> GetOnlineUsers()
        {
            try
            {
                var users = await _privateChatService.GetOnlineUsersAsync();
                return Ok(new { success = true, users });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === Приватные чаты ===

        [HttpPost("chat/create")]
        public async Task<IActionResult> CreateChat([FromBody] CreateChatRequest request)
        {
            try
            {
                var chatId = await _privateChatService.GetOrCreatePrivateChatAsync(
                    request.User1Id,
                    request.User2Id
                );

                return Ok(new { success = true, chatId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("user/{userId}/chats")]
        public async Task<IActionResult> GetUserChats(string userId)
        {
            try
            {
                var chats = await _privateChatService.GetUserChatsAsync(userId);
                return Ok(new { success = true, chats });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("message/send")]
        public async Task<IActionResult> SendMessage([FromBody] PrivateMessageRequest request)
        {
            try
            {
                // Проверяем, не заблокирован ли пользователь
                var isMuted = await _privateChatService.IsUserMutedAsync(request.SenderId);
                if (isMuted)
                {
                    return BadRequest(new { error = "Вы временно заблокированы" });
                }

                var message = await _privateChatService.SendPrivateMessageAsync(
                    request.ChatId,
                    request.SenderId,
                    request.ReceiverId,
                    request.Content,
                    request.ReplyToId
                );

                return Ok(new { success = true, message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("chat/{chatId}/history")]
        public async Task<IActionResult> GetHistory(string chatId, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
        {
            try
            {
                var messages = await _privateChatService.GetPrivateMessagesAsync(chatId, limit, offset);
                return Ok(new { success = true, messages, total = messages.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("chat/mark-read")]
        public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest request)
        {
            try
            {
                var result = await _privateChatService.MarkMessagesAsReadAsync(request.ChatId, request.UserId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Удаление сообщения Надо подумать и разнести
        /// </summary>
        [HttpDelete("message/{messageId}")]
        public async Task<IActionResult> DeleteMessage(string messageId, [FromQuery] string userId)
        {
            try
            {
                var result = await _privateChatService.DeletePrivateMessageAsync(messageId, userId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }


        [HttpPost("message/{messageId}")]
        public async Task<IActionResult> EditMessage(string messageId, [FromBody] EditMessageRequest request)
        {
            try
            {
                var result = await _privateChatService.EditPrivateMessageAsync(messageId, request.UserId, request.NewContent);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("user/{userId}/unread")]
        public async Task<IActionResult> GetUnread(string userId)
        {
            try
            {
                var count = await _privateChatService.GetUnreadCountAsync(userId);
                return Ok(new { success = true, unread = count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === Блокировка ===

        [HttpPost("user/block")]
        public async Task<IActionResult> BlockUser([FromBody] BlockUserRequest request)
        {
            try
            {
                var result = await _privateChatService.BlockUserAsync(request.UserId, request.BlockUserId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("user/unblock")]
        public async Task<IActionResult> UnblockUser([FromBody] BlockUserRequest request)
        {
            try
            {
                var result = await _privateChatService.UnblockUserAsync(request.UserId, request.BlockUserId);
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("user/{userId}/blocked")]
        public async Task<IActionResult> GetBlockedUsers(string userId)
        {
            try
            {
                var blocked = await _privateChatService.GetBlockedUsersAsync(userId);
                return Ok(new { success = true, blocked });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // === Heartbeat ===

        [HttpPost("heartbeat")]
        public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest request)
        {
            try
            {
                var result = await _privateChatService.UpdateHeartbeatAsync(request.UserId);
                await _privateChatService.CheckInactiveUsersAsync();
                return Ok(new { success = result });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    // DTO
    public class UserProfileRequest
    {
        public string UserId { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string Color { get; set; }
        public string AvatarType { get; set; }
        public string AvatarData { get; set; }

    }

    public class CreateChatRequest
    {
        public string User1Id { get; set; }
        public string User2Id { get; set; }
    }

    public class PrivateMessageRequest
    {
        public string ChatId { get; set; }
        public string SenderId { get; set; }
        public string ReceiverId { get; set; }
        public string Content { get; set; }
        public string ReplyToId { get; set; }
    }

    public class MarkReadRequest
    {
        public string ChatId { get; set; }
        public string UserId { get; set; }
    }

    public class HeartbeatRequest
    {
        public string UserId { get; set; }
    }

    public class BlockUserRequest
    {
        public string UserId { get; set; }
        public string BlockUserId { get; set; }
    }

    /*
    public class EditMessageRequest
    {
        public string UserId { get; set; }
        public string NewContent { get; set; }
    }
    */

    public class EditMessageRequest
    {
        public string RoomId { get; set; }
        public string MessageId { get; set; }
        public string UserId { get; set; }
        public string NewContent { get; set; }
    }
}