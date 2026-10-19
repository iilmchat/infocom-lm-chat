using System;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Ответ с информацией о документе
    /// </summary>
    public class DocumentDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string Type { get; set; }
        public int Version { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int CreatedBy { get; set; }
        public string CreatorName { get; set; }
        public bool IsActive { get; set; }
        public bool IsAccepted { get; set; }
        public DateTime? AcceptedAt { get; set; }
        public int? AcceptedBy { get; set; }
        public string AcceptorName { get; set; }
    }
}