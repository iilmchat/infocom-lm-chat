// Models/UserInfo.cs
using System;

namespace InfocomChat.Server.Models
{
    /// <summary>
    /// Информация о пользователе для передачи по сети
    /// </summary>
    public class UserInfo
    {
        /// <summary>
        /// Уникальный идентификатор пользователя
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Отображаемое имя пользователя
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Аватар пользователя (эмодзи или URL)
        /// </summary>
        public string Avatar { get; set; }

        /// <summary>
        /// Аватар пользователя (тип: emoji, initials, image)
        /// </summary>
        public string AvatarType { get; set; }

        /// <summary>
        /// Аватар пользователя (base64)
        /// </summary>
        public string AvatarData { get; set; }

        /// <summary>
        /// Цвет пользователя в интерфейсе (HEX)
        /// </summary>
        public string Color { get; set; }

        /// <summary>
        /// Статус печатания в данный момент
        /// </summary>
        public bool IsTyping { get; set; }

        /// <summary>
        /// Время последней активности пользователя
        /// </summary>
        public DateTime LastSeen { get; set; }

        /// <summary>
        /// ID комнаты, в которой находится пользователь
        /// </summary>
        public string RoomId { get; set; }

        /// <summary>
        /// Роль пользователя (admin, moderator, user, guest)
        /// </summary>
        public string Role { get; set; }

        /// <summary>
        /// Электронная почта (если есть)
        /// </summary>
        public string Email { get; set; }

        /// <summary>
        /// Статус пользователя (online, away, offline)
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Время подключения к комнате
        /// </summary>
        public DateTime JoinedAt { get; set; }

        /// <summary>
        /// Количество отправленных сообщений
        /// </summary>
        public int MessageCount { get; set; }

        /// <summary>
        /// Количество непрочитанных сообщений
        /// </summary>
        public int UnreadCount { get; set; }

        /// <summary>
        /// Дополнительные данные пользователя
        /// </summary>
        // Удалено в версии 5.2
        // public object ExtraData { get; set; }

        public UserInfo()
        {
            Id = Guid.NewGuid().ToString();
            LastSeen = DateTime.UtcNow;
            JoinedAt = DateTime.UtcNow;
            Role = "user";
            Status = "online";
            Avatar = "👤";
            AvatarType = "emoji";
            AvatarData = "";
            Color = "#7ec8e3";
            MessageCount = 0;
            UnreadCount = 0;
        }

        /// <summary>
        /// Создание копии пользователя
        /// </summary>
        public UserInfo Clone()
        {
            return new UserInfo
            {
                Id = this.Id,
                Name = this.Name,
                Avatar = this.Avatar,
                AvatarType = this.AvatarType,
                AvatarData = this.AvatarData,
                Color = this.Color,
                IsTyping = this.IsTyping,
                LastSeen = this.LastSeen,
                RoomId = this.RoomId,
                Role = this.Role,
                Email = this.Email,
                Status = this.Status,
                JoinedAt = this.JoinedAt,
                MessageCount = this.MessageCount,
                UnreadCount = this.UnreadCount
                //,ExtraData = this.ExtraData
            };
        }

        /// <summary>
        /// Проверка, активен ли пользователь (был активен в последние 5 минут)
        /// </summary>
        public bool IsActive()
        {
            return (DateTime.UtcNow - LastSeen).TotalMinutes < 5;
        }

        /// <summary>
        /// Проверка, является ли пользователь администратором
        /// </summary>
        public bool IsAdmin()
        {
            return Role == "admin" || Role == "moderator";
        }
    }

    /// <summary>
    /// Краткая информация о пользователе для передачи по сети
    /// </summary>
    public class UserInfoBrief
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string AvatarType { get; set; }
        public string AvatarData { get; set; }
        public string Color { get; set; }
        public bool IsTyping { get; set; }
        public string Status { get; set; }
    }
}