// DTOs/BotDtos.cs
using System;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Аккаунт бота
    /// </summary>
    public class BotAccountDto
    {
        public string BotId { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string ApiKey { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public string OwnerId { get; set; }
    }

    /// <summary>
    /// Запрос на отправку сообщения от бота
    /// </summary>
    public class BotMessageRequest
    {
        public string ApiKey { get; set; }
        public string RoomId { get; set; }
        public string Content { get; set; }
        public string ReplyToId { get; set; }
    }

    /// <summary>
    /// Запрос на вход бота в комнату
    /// </summary>
    public class BotJoinRequest
    {
        public string ApiKey { get; set; }
        public string RoomId { get; set; }
    }
}