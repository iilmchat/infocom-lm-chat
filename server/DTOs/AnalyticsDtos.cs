// DTOs/AnalyticsDtos.cs
using System;
using System.Collections.Generic;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Активность пользователя за период
    /// </summary>
    public class UserActivityDto
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public int TotalMessages { get; set; }
        public int MessagesPerDay { get; set; }
        public int ActiveDays { get; set; }
        public DateTime From { get; set; }
        public DateTime To { get; set; }
        public Dictionary<DateTime, int> DailyActivity { get; set; }
        public Dictionary<string, int> RoomsActivity { get; set; }
    }

    /// <summary>
    /// Вовлечённость в комнате
    /// </summary>
    public class RoomEngagementDto
    {
        public string RoomId { get; set; }
        public string RoomName { get; set; }
        public int UniqueUsers { get; set; }
        public int TotalMessages { get; set; }
        public double AverageMessageLength { get; set; }
        public Dictionary<int, int> HourlyDistribution { get; set; } // час -> количество сообщений
        public DateTime PeakHour { get; set; }
        public List<string> TopUsers { get; set; }
    }

    /// <summary>
    /// Глобальная аналитика
    /// </summary>
    public class GlobalAnalyticsDto
    {
        public int DailyActiveUsers { get; set; }
        public int MonthlyActiveUsers { get; set; }
        public int TotalUsers { get; set; }
        public int TotalMessages { get; set; }
        public int MessagesToday { get; set; }
        //public Dictionary<DateTime, int> MessagesPerDay { get; set; }
        public List<MessageCountDto> MessagesPerDay { get; set; } = new List<MessageCountDto>();
        public int OnlineUsers { get; set; }
        public int ActiveRooms { get; set; }
    }

    public class MessageCountDto
    {
        public DateTime MessageDate { get; set; }

        public int MessageCount { get; set; }
    }

}