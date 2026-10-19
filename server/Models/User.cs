using System;
using System.Collections.Generic;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Пользователь системы
    /// </summary>
    public class User
    {
        public int Id { get; set; }

        /// <summary>Уникальное имя пользователя</summary>
        public string Username { get; set; }

        /// <summary>Хэш пароля (BCrypt)</summary>
        public string PasswordHash { get; set; }

        /// <summary>Роль: "User" или "Admin"</summary>
        public string Role { get; set; } = "User";

        /// <summary>Дата регистрации</summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Навигационное свойство для сессий
        public ICollection<Session> Sessions { get; set; }
    }
}