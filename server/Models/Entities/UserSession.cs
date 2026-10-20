// Models/Entities/UserSession.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Сессия пользователя (для управления устройствами)
    /// </summary>
    [Table("UserSessions")]
    public class UserSession
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string SessionId { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        [MaxLength(100)]
        public string DeviceName { get; set; }

        [MaxLength(50)]
        public string DeviceType { get; set; } // mobile, desktop, web

        public string IpAddress { get; set; }

        public string UserAgent { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime LastActivity { get; set; } = DateTime.UtcNow;

        public bool IsActive { get; set; } = true;

        public DateTime? ExpiresAt { get; set; }

        // Навигационное свойство
        public virtual User User { get; set; }
    }
}