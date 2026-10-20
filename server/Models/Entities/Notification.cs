// Models/Entities/Notification.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Уведомление пользователя
    /// </summary>
    [Table("Notifications")]
    public class Notification
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string NotificationId { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } // mention, reaction, message, system

        public string Title { get; set; }

        public string Body { get; set; }

        public string DataJson { get; set; } // дополнительные данные в JSON

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ReadAt { get; set; }

        // Навигационное свойство
        public virtual User User { get; set; }
    }
}