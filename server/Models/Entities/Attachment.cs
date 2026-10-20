// Models/Entities/Attachment.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    [Table("Attachments")]
    public class Attachment
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string AttachmentId { get; set; }

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; }

        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; }

        public long FileSize { get; set; }

        [MaxLength(100)]
        public string MimeType { get; set; }

        public DateTime UploadedAt { get; set; }

        // Метаданные (JSON)
        public string MetadataJson { get; set; }

        // Навигационные свойства
        public virtual PrivateMessage Message { get; set; }

        public Attachment()
        {
            AttachmentId = Guid.NewGuid().ToString();
            UploadedAt = DateTime.UtcNow;
            MetadataJson = "{}";
        }
    }

    public class AttachmentUploadResult
    {
        public string AttachmentId { get; set; }
        public string FileName { get; set; }
        public long FileSize { get; set; }
        public string MimeType { get; set; }
        public string Url { get; set; }
    }
}