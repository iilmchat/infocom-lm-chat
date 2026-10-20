// Models/AdminModels.cs
using System;
using System.Collections.Generic;

namespace InfocomChat.Server.Models
{
    /// <summary>
    /// Информация о пользователе для администратора
    /// </summary>
    public class AdminUserInfo
    {
        /// <summary>Идентификатор</summary>
        public string Id { get; set; }

        /// <summary>Имя</summary>
        public string Name { get; set; }

        /// <summary>Аватар</summary>
        public string Avatar { get; set; }

        /// <summary>Цвет</summary>
        public string Color { get; set; }

        /// <summary>Онлайн?</summary>
        public bool IsOnline { get; set; }

        /// <summary>Статус</summary>
        public string Status { get; set; }

        /// <summary>Администратор?</summary>
        public bool IsAdmin { get; set; }

        /// <summary>Модератор?</summary>
        public bool IsModerator { get; set; }

        /// <summary>Забанен?</summary>
        public bool IsBanned { get; set; }

        /// <summary>Причина бана</summary>
        public string BanReason { get; set; }

        /// <summary>До какого времени действует мут</summary>
        public DateTime? MutedUntil { get; set; }

        /// <summary>Дата регистрации</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Время последней активности</summary>
        public DateTime LastSeen { get; set; }

        /// <summary>Количество сообщений</summary>
        public int MessageCount { get; set; }

        /// <summary>Количество комнат</summary>
        public int RoomCount { get; set; }
    }

    /// <summary>
    /// Информация о комнате для администратора
    /// </summary>
    public class AdminRoomInfo
    {
        /// <summary>Идентификатор комнаты</summary>
        public string Id { get; set; }

        /// <summary>Название</summary>
        public string Name { get; set; }

        /// <summary>Дата создания</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Кем создана</summary>
        public string CreatedBy { get; set; }

        /// <summary>Количество пользователей</summary>
        public int UserCount { get; set; }

        /// <summary>Количество сообщений</summary>
        public int MessageCount { get; set; }

        /// <summary>Время последней активности</summary>
        public DateTime LastActivity { get; set; }

        /// <summary>Активна?</summary>
        public bool IsActive { get; set; }

        /// <summary>Приватная?</summary>
        public bool IsPrivate { get; set; }
    }

    /// <summary>
    /// Общая статистика для администратора
    /// </summary>
    public class AdminStats
    {
        /// <summary>Всего пользователей</summary>
        public int TotalUsers { get; set; }

        /// <summary>Онлайн пользователей</summary>
        public int OnlineUsers { get; set; }
        
        /// <summary>Всего чатов</summary>      
        public int TotalChats { get; set; }

        /// <summary>Всего комнат</summary>        
        public int TotalRooms { get; set; }

        /// <summary>Всего сообщений (включая приватные)</summary>
        public int TotalMessages { get; set; }

        /// <summary>Приватных сообщений</summary>
        public int PrivateMessages { get; set; }

        /// <summary>Дата обновления</summary>
        public DateTime Timestamp { get; set; }

        /// <summary>Время работы сервера (uptime)</summary>        
        public DateTime Uptime { get; set; }

        /// <summary>Забаненных пользователей</summary>
        public int BannedUsers { get; set; }

        /// <summary>Заглушенных пользователей</summary>
        public int MutedUsers { get; set; }
    }

    /// <summary>
    /// Действие модерации в логе
    /// </summary>
    public class ModerationAction
    {
        /// <summary>Идентификатор записи</summary>
        public string Id { get; set; }

        /// <summary>ID модератора</summary>
        public string ModeratorId { get; set; }

        /// <summary>Имя модератора</summary>
        public string ModeratorName { get; set; }

        /// <summary>ID целевого пользователя</summary>
        public string TargetUserId { get; set; }

        /// <summary>Имя целевого пользователя</summary>
        public string TargetUserName { get; set; }

        /// <summary>Тип действия (mute, kick, ban, unban, warn)</summary>
        public string Action { get; set; }

        /// <summary>Причина</summary>
        public string Reason { get; set; }

        /// <summary>Время действия</summary>
        public DateTime Timestamp { get; set; }

        /// <summary>Длительность (в минутах, для мута)</summary>
        public int DurationMinutes { get; set; }
    }
}