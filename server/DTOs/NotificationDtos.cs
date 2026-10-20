// DTOs/NotificationDtos.cs
using System;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Уведомление пользователя
    /// </summary>
    public class NotificationDto
    {
        public string NotificationId { get; set; }
        public string Type { get; set; } // mention, reaction, message, system
        public string Title { get; set; }
        public string Body { get; set; }
        public object Data { get; set; } // дополнительные данные
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
    }

    /// <summary>
    /// Запрос на отметку уведомлений как прочитанных
    /// </summary>
    public class MarkNotificationsReadRequest
    {
        public string UserId { get; set; }
        public string[] NotificationIds { get; set; } // если null, то все
    }
}