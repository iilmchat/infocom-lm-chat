// Models/Entities/Report.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Жалоба на сообщение
    /// </summary>
    [Table("Reports")]
    public class Report
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ReportId { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string ReporterId { get; set; }

        [MaxLength(50)]
        public string Reason { get; set; }

        public string Description { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsResolved { get; set; }

        [MaxLength(50)]
        public string ResolvedBy { get; set; }

        public DateTime? ResolvedAt { get; set; }

        // Навигационные свойства
        public virtual PrivateMessage Message { get; set; }
        public virtual User Reporter { get; set; }
        public virtual User Resolver { get; set; }
    }
}