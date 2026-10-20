// DTOs/SendMessageDto.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// DTO для отправки сообщения
    /// </summary>
    public class SendMessageDto
    {
        /// <summary>
        /// ID комнаты
        /// </summary>
        [Required]
        [MaxLength(50)]        
        public string RoomId { get; set; }

        /// <summary>
        /// ID пользователя
        /// </summary>
        [Required]
        [MaxLength(50)]        
        public string UserId { get; set; }

        /// <summary>
        /// Имя пользователя
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string UserName { get; set; }

        /// <summary>
        /// Аватар пользователя
        /// </summary>
        [MaxLength(10)]
        public string UserAvatar { get; set; }

        /// <summary>
        /// Текст сообщения
        /// </summary>
        [Required]
        [MaxLength(10000)]
        public string Content { get; set; }

        /// <summary>
        /// Роль отправителя (user/assistant)
        /// </summary>
        [MaxLength(20)]
        public string Role { get; set; }

        /// <summary>
        /// ID сообщения, на которое отвечаем
        /// </summary>
        [MaxLength(50)]
        public string ReplyToId { get; set; }

        /// <summary>
        /// Используемая модель
        /// </summary>
        [MaxLength(50)]
        public string Model { get; set; }

        /// <summary>
        /// Вложения
        /// </summary>
        public List<FileAttachmentDto> Attachments { get; set; }

        /// <summary>
        /// Источники RAG
        /// </summary>
        public List<RagSourceDto> RagSources { get; set; }

        /// <summary>
        /// Дополнительные метаданные
        /// </summary>
        public Dictionary<string, object> Metadata { get; set; }
    }

    /// <summary>
    /// DTO для вложения
    /// </summary>
    public class FileAttachmentDto
    {
        [Required]
        [MaxLength(255)]
        public string Name { get; set; }

        [MaxLength(10 * 1024 * 1024)]
        public string Content { get; set; }

        [Range(0, 10 * 1024 * 1024)]
        public long Size { get; set; }

        [MaxLength(100)]
        public string Type { get; set; }
    }

    /// <summary>
    /// DTO для источника RAG
    /// </summary>
    public class RagSourceDto
    {
        [MaxLength(500)]
        public string Source { get; set; }

        [MaxLength(5000)]
        public string Chunk { get; set; }

        [Range(0, 1)]
        public double Similarity { get; set; }
    }

    /// <summary>
    /// Ответ на отправку сообщения
    /// </summary>
    public class SendMessageResponseDto
    {
        public bool Success { get; set; }
        public string MessageId { get; set; }
        public DateTime Timestamp { get; set; }
        public string Error { get; set; }
    }
}