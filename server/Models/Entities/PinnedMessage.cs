// Models/Entities/PinnedMessage.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Закреплённое сообщение в комнате
    /// </summary>
    [Table("PinnedMessages")]
    public class PinnedMessage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string PinnedId { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RoomId { get; set; }

        [Required]
        [MaxLength(50)]
        public string PinnedBy { get; set; }

        public DateTime PinnedAt { get; set; } = DateTime.UtcNow;

        // Навигационные свойства
        public virtual PrivateMessage Message { get; set; }
        public virtual User User { get; set; }
    }
}