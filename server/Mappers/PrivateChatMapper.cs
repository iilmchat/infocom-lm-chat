// Mappers/PrivateChatMapper.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models;
//using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;
using PrivateMessage = InfocomChat.Server.Models.Entities.PrivateMessage;

namespace InfocomChat.Server.Mappers
{
    /// <summary>
    /// Маппер для преобразования сущностей приватных чатов в DTO
    /// </summary>
    public static class PrivateChatMapper
    {
        /// <summary>
        /// Преобразует сущность PrivateMessage в PrivateMessageDto
        /// </summary>
        public static PrivateMessageDto ToPrivateMessageDto(this PrivateMessage message)
        {
            if (message == null) return null;

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
                    ? JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    : new List<FileAttachment>(),
                AttachmentsJson = message.AttachmentsJson
            };
        }

        /// <summary>
        /// Преобразует сущность PrivateChat в PrivateChatDto
        /// </summary>
        public static PrivateChatDto ToPrivateChatDto(this PrivateChat chat)
        {
            if (chat == null) return null;

            var chatDto = new PrivateChatDto
            {
                ChatId = chat.ChatId,
                User1Id = chat.User1Id,
                User2Id = chat.User2Id,
                LastMessage = chat.LastMessage,
                LastMessageAt = chat.LastMessageAt,
                CreatedAt = chat.CreatedAt,
                LastActivity = chat.LastActivity,
                IsActive = chat.IsActive
            };

            // Маппинг пользователей, если они загружены
            if (chat.User1 != null)
            {
                chatDto.User1 = new UserPreviewDto
                {
                    UserId = chat.User1.UserId,
                    Name = chat.User1.Name,
                    Avatar = chat.User1.Avatar,
                    AvatarType = chat.User1.AvatarType,
                    AvatarData = chat.User1.AvatarData,
                    Color = chat.User1.Color,
                    Status = chat.User1.Status,
                    IsOnline = chat.User1.IsOnline
                };
            }

            if (chat.User2 != null)
            {
                chatDto.User2 = new UserPreviewDto
                {
                    UserId = chat.User2.UserId,
                    Name = chat.User2.Name,
                    Avatar = chat.User2.Avatar,
                    AvatarType = chat.User2.AvatarType,
                    AvatarData = chat.User2.AvatarData,
                    Color = chat.User2.Color,
                    Status = chat.User2.Status,
                    IsOnline = chat.User2.IsOnline
                };
            }

            // Маппинг сообщений
            if (chat.PrivateMessages != null && chat.PrivateMessages.Any())
            {
                chatDto.PrivateMessages = chat.PrivateMessages
                    .Select(m => m.ToPrivateMessageDto())
                    .ToList();
            }

            return chatDto;
        }

        /// <summary>
        /// Преобразует коллекцию PrivateMessage в список PrivateMessageDto
        /// </summary>
        public static List<PrivateMessageDto> ToPrivateMessageDtos(this IEnumerable<PrivateMessage> messages)
        {
            return messages?.Select(m => m.ToPrivateMessageDto()).ToList() ?? new List<PrivateMessageDto>();
        }

        /// <summary>
        /// Преобразует коллекцию PrivateChat в список PrivateChatDto
        /// </summary>
        public static List<PrivateChatDto> ToPrivateChatDtos(this IEnumerable<PrivateChat> chats)
        {
            return chats?.Select(c => c.ToPrivateChatDto()).ToList() ?? new List<PrivateChatDto>();
        }
    }
}