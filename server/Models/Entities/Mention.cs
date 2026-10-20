// Models/Entities/Mention.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    [Table("Mentions")]
    public class Mention
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string MentionId { get; set; }

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; } // Кто был упомянут

        [MaxLength(50)]
        public string MentionedBy { get; set; } // Кто упомянул

        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }

        public DateTime CreatedAt { get; set; }

        // Навигационные свойства
        public virtual PrivateMessage Message { get; set; }
        public virtual User User { get; set; }
        public virtual User MentionedByUser { get; set; }

        public Mention()
        {
            MentionId = Guid.NewGuid().ToString();
            CreatedAt = DateTime.UtcNow;
            IsRead = false;
        }
    }
}