using System;
using System.Collections.Generic;

namespace InfocomChat.Server.Models
{
    /// <summary>
    /// Информация о комнате чата
    /// </summary>
    public class RoomInfo
    {
        /// <summary>
        /// Уникальный идентификатор комнаты
        /// </summary>
        public string RoomId { get; set; }

        /// <summary>
        /// Отображаемое название комнаты
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Описание комнаты (необязательно)
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// Время создания комнаты
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Кто создал комнату (ID пользователя)
        /// </summary>
        public string CreatedBy { get; set; }

        /// <summary>
        /// Список пользователей в комнате
        /// </summary>
        public List<UserInfo> Users { get; set; }

        /// <summary>
        /// История сообщений
        /// </summary>
        public List<ChatMessage> Messages { get; set; }

        /// <summary>
        /// Текущая модель для чата
        /// </summary>
        public string Model { get; set; }

        /// <summary>
        /// Общее количество сообщений
        /// </summary>
        public int MessageCount { get; set; }

        /// <summary>
        /// Общее количество пользователей в комнате
        /// </summary>
        public int UserCount { get; set; }
        /// <summary>
        /// Время последней активности в комнате
        /// </summary>
        public DateTime LastActivity { get; set; }

        /// <summary>
        /// Данные RAG для комнаты (сохраняются как JSON)
        /// </summary>
        public object RagData { get; set; }

        /// <summary>
        /// Настройки комнаты
        /// </summary>
        public RoomSettings Settings { get; set; }

        /// <summary>
        /// Является ли комната приватной
        /// </summary>
        public bool IsPrivate { get; set; }

        /// <summary>
        /// Является ли комната активной
        /// </summary>
        public bool IsActive{ get; set; }
        /// <summary>
        /// Пароль для входа в приватную комнату (хеш)
        /// </summary>
        public string PasswordHash { get; set; }

        /// <summary>
        /// Дополнительные метаданные
        /// </summary>
        // Удалено в версии 5.2
        // public Dictionary<string, object> Metadata { get; set; }

        public RoomInfo()
        {
            Users = new List<UserInfo>();
            Messages = new List<ChatMessage>();
            Settings = new RoomSettings();
            //Metadata = new Dictionary<string, object>();
            CreatedAt = DateTime.UtcNow;
            LastActivity = DateTime.UtcNow;
            Model = "local-model";
            MessageCount = 0;
            UserCount = 0;
            IsPrivate = false;
            IsActive = true;
        }
    }

    /// <summary>
    /// Настройки комнаты
    /// </summary>
    public class RoomSettings
    {
        /// <summary>
        /// Максимальное количество сообщений в истории
        /// </summary>
        public int MaxHistory { get; set; } = 1000;

        /// <summary>
        /// Требуется ли подтверждение для входа
        /// </summary>
        public bool RequireApproval { get; set; } = false;

        /// <summary>
        /// Доступна ли RAG
        /// </summary>
        public bool RagEnabled { get; set; } = true;

        /// <summary>
        /// Доступен ли экспорт
        /// </summary>
        public bool ExportEnabled { get; set; } = true;

        /// <summary>
        /// Доступны ли гостевые пользователи
        /// </summary>
        public bool AllowGuests { get; set; } = true;

        /// <summary>
        /// Язык по умолчанию
        /// </summary>
        public string DefaultLanguage { get; set; } = "ru";

        /// <summary>
        /// Максимальное количество пользователей
        /// </summary>
        public int MaxUsers { get; set; } = 50;

        /// <summary>
        /// Время жизни комнаты в минутах (0 - бесконечно)
        /// </summary>
        public int LifetimeMinutes { get; set; } = 0;

        /// <summary>
        /// Разрешено ли редактирование сообщений
        /// </summary>
        public bool AllowEditing { get; set; } = true;

        /// <summary>
        /// Разрешено ли удаление сообщений
        /// </summary>
        public bool AllowDeletion { get; set; } = true;

        /// <summary>
        /// Доступен ли Code Review
        /// </summary>
        public bool CodeReviewEnabled { get; set; } = true;

        /// <summary>
        /// Доступна ли генерация тестов
        /// </summary>
        public bool TestGenerationEnabled { get; set; } = true;
    }
}