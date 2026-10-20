// Mappers/MessageMapper.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Mappers
{
    /// <summary>
    /// Маппер для преобразования сущностей Message в ChatMessage и обратно
    /// </summary>
    public static class MessageMapper
    {
        /// <summary>
        /// Преобразует сущность Message в ChatMessage
        /// </summary>
        public static ChatMessage ToChatMessage(this Message message)
        {
            if (message == null) return null;

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
                    ? JsonSerializer.Deserialize<List<FileAttachment>>(message.AttachmentsJson)
                    : new List<FileAttachment>(),
                Metadata = !string.IsNullOrEmpty(message.MetadataJson)
                    ? JsonSerializer.Deserialize<Dictionary<string, object>>(message.MetadataJson)
                    : new Dictionary<string, object>()
            };
        }

        /// <summary>
        /// Преобразует ChatMessage в сущность Message
        /// </summary>
        public static Message ToMessageEntity(this ChatMessage chatMessage)
        {
            if (chatMessage == null) return null;

            return new Message
            {
                MessageId = chatMessage.Id,
                RoomId = chatMessage.RoomId,
                UserId = chatMessage.UserId,
                UserName = chatMessage.UserName,
                UserAvatar = chatMessage.UserAvatar,
                Role = chatMessage.Role,
                Content = chatMessage.Content,
                Timestamp = chatMessage.Timestamp,
                ReplyToId = chatMessage.ReplyToId,
                IsEdited = chatMessage.IsEdited,
                Model = chatMessage.Model,
                AttachmentsJson = chatMessage.Attachments != null
                    ? JsonSerializer.Serialize(chatMessage.Attachments)
                    : "[]",
                MetadataJson = chatMessage.Metadata != null
                    ? JsonSerializer.Serialize(chatMessage.Metadata)
                    : "{}"
            };
        }

        /// <summary>
        /// Преобразует коллекцию Message в список ChatMessage
        /// </summary>
        public static List<ChatMessage> ToChatMessages(this IEnumerable<Message> messages)
        {
            return messages?.Select(m => m.ToChatMessage()).ToList() ?? new List<ChatMessage>();
        }

        /// <summary>
        /// Преобразует коллекцию ChatMessage в список Message
        /// </summary>
        public static List<Message> ToMessageEntities(this IEnumerable<ChatMessage> chatMessages)
        {
            return chatMessages?.Select(m => m.ToMessageEntity()).ToList() ?? new List<Message>();
        }
    }
}