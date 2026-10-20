// DTOs/SessionDtos.cs
using System;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Информация о сессии
    /// </summary>
    public class SessionDto
    {
        public string SessionId { get; set; }
        public string DeviceName { get; set; }
        public string DeviceType { get; set; }
        public string IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public bool IsActive { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    /// <summary>
    /// Запрос на завершение сессии
    /// </summary>
    public class EndSessionRequest
    {
        public string SessionId { get; set; }
        public string UserId { get; set; }
    }
}