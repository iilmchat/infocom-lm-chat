using System;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// DTO сессии пользователя (без раскрытия полного токена).
    /// </summary>
    public class SessionDto
    {
        /// <summary>
        /// Идентификатор сессии.
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// Маскированный токен (первые символы + "..."). 
        /// Полный токен не возвращается из соображений безопасности.
        /// </summary>
        public string TokenPreview { get; set; }

        /// <summary>
        /// Дата создания сессии.
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Дата истечения сессии.
        /// </summary>
        public DateTime ExpiresAt { get; set; }

        /// <summary>
        /// Признак активности сессии.
        /// </summary>
        public bool IsActive { get; set; }
    }
}