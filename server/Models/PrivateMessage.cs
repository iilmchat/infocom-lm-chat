// Models/PrivateMessage.cs
using System;
using System.Collections.Generic;

namespace InfocomChat.Server.Models
{
    /// <summary>
    /// Приватное сообщение
    /// </summary>
    public class PrivateMessage
    {
        /// <summary>Идентификатор</summary>
        public string Id { get; set; }

        /// <summary>ID чата</summary>
        public string ChatId { get; set; }

        /// <summary>ID отправителя</summary>
        public string SenderId { get; set; }

        /// <summary>Имя отправителя</summary>
        public string SenderName { get; set; }

        /// <summary>Аватар отправителя</summary>
        public string SenderAvatar { get; set; }

        /// <summary>ID получателя</summary>
        public string ReceiverId { get; set; }

        /// <summary>Текст</summary>
        public string Content { get; set; }

        /// <summary>Время отправки</summary>
        public DateTime Timestamp { get; set; }

        /// <summary>Прочитано?</summary>
        public bool IsRead { get; set; }

        /// <summary>Время прочтения</summary>
        public DateTime? ReadAt { get; set; }

        /// <summary>ID ответа</summary>
        public string ReplyToId { get; set; }

        /// <summary>Вложения</summary>
        public List<FileAttachment> Attachments { get; set; }

        /// <summary>Отредактировано?</summary>
        public bool IsEdited { get; set; }

        /// <summary>Время редактирования</summary>
        public DateTime? EditedAt { get; set; }
    }

    /// <summary>
    /// Профиль пользователя (для приватных чатов)
    /// </summary>
    public class UserProfile
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string Color { get; set; }
        public DateTime LastSeen { get; set; }
        public bool IsOnline { get; set; }
        public string Status { get; set; } // online, away, busy, offline
        public List<string> Rooms { get; set; }
        public int UnreadCount { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsModerator { get; set; }
        public DateTime? MutedUntil { get; set; }
        public List<string> BlockedUsers { get; set; }
        public string BanReason { get; set; }
        public DateTime? BannedAt { get; set; }
        public int MessageCount { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }

    /// <summary>
    /// Комната приватного чата
    /// </summary>
    public class PrivateChatRoom
    {
        public string Id { get; set; }
        public string User1Id { get; set; }
        public string User2Id { get; set; }
        public List<PrivateMessage> Messages { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public bool IsActive { get; set; }
        public string LastMessage { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }
}