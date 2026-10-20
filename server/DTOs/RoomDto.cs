using System;
using System.Collections.Generic;
using InfocomChat.Server.Models;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// DTO для создания комнаты
    /// </summary>
    public class CreateRoomDto
    {
        /// <summary>
        /// Название комнаты
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Описание комнаты
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// ID создателя
        /// </summary>
        public string CreatedBy { get; set; }

        /// <summary>
        /// Приватная ли комната
        /// </summary>
        public bool IsPrivate { get; set; }

        /// <summary>
        /// Пароль (для приватной комнаты)
        /// </summary>
        public string Password { get; set; }

        /// <summary>
        /// Настройки комнаты
        /// </summary>
        public RoomSettingsDto Settings { get; set; }
    }

    /// <summary>
    /// DTO для входа в комнату
    /// </summary>
    public class JoinRoomDto
    {
        /// <summary>
        /// ID комнаты
        /// </summary>
        public string RoomId { get; set; }

        /// <summary>
        /// Информация о пользователе
        /// </summary>
        public UserInfoDto User { get; set; }

        /// <summary>
        /// Пароль (для приватной комнаты)
        /// </summary>
        public string Password { get; set; }
    }

    /// <summary>
    /// DTO для информации о комнате
    /// </summary>
    public class RoomInfoDto
    {
        public string RoomId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; }
        public int UserCount { get; set; }
        public int MessageCount { get; set; }
        public DateTime LastActivity { get; set; }
        public string Model { get; set; }
        public bool IsPrivate { get; set; }
        public RoomSettingsDto Settings { get; set; }
        public List<UserInfoBriefDto> Users { get; set; }
    }

    /// <summary>
    /// DTO для списка комнат
    /// </summary>
    public class RoomListDto
    {
        public List<RoomInfoDto> Rooms { get; set; }
        public int Total { get; set; }
    }

    /// <summary>
    /// DTO для настроек комнаты
    /// </summary>
    public class RoomSettingsDto
    {
        public int MaxHistory { get; set; } = 1000;
        public bool RequireApproval { get; set; } = false;
        public bool RagEnabled { get; set; } = true;
        public bool ExportEnabled { get; set; } = true;
        public bool AllowGuests { get; set; } = true;
        public string DefaultLanguage { get; set; } = "ru";
        public int MaxUsers { get; set; } = 50;
        public int LifetimeMinutes { get; set; } = 0;
        public bool AllowEditing { get; set; } = true;
        public bool AllowDeletion { get; set; } = true;
        public bool CodeReviewEnabled { get; set; } = true;
        public bool TestGenerationEnabled { get; set; } = true;
    }

    /// <summary>
    /// DTO для обновления комнаты
    /// </summary>
    public class UpdateRoomDto
    {
        public string RoomId { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public RoomSettingsDto Settings { get; set; }
        public string Model { get; set; }
    }

    /// <summary>
    /// Ответ на создание комнаты
    /// </summary>
    public class CreateRoomResponseDto
    {
        public bool Success { get; set; }
        public string RoomId { get; set; }
        public string Error { get; set; }
    }

    /// <summary>
    /// Ответ на вход в комнату
    /// </summary>
    public class JoinRoomResponseDto
    {
        public bool Success { get; set; }
        public RoomInfoDto Room { get; set; }
        public List<ChatMessage> History { get; set; }
        public List<UserInfoDto> Users { get; set; }
        public string Error { get; set; }
    }
}