using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Сессия (активный JWT-токен)
    /// </summary>
    public class Session
    {
        public int Id { get; set; }

        /// <summary>Идентификатор пользователя</summary>
        public int UserId { get; set; }

        /// <summary>JWT-токен (строка)</summary>
        public string Token { get; set; }

        /// <summary>Время истечения токена</summary>
        public DateTime ExpiresAt { get; set; }

        /// <summary>Время создания сессии</summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Признак активности (мягкое удаление)</summary>
        public bool IsActive { get; set; } = true;

        // Навигационное свойство
        public User User { get; set; }
    }
}