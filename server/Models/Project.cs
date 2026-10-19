using System;
using System.Collections.Generic;

namespace ProjectManager.API.Models
{
    public enum ProjectStatus { Active = 0, Closed = 1 }

    public class Project
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public ProjectStatus Status { get; set; } = ProjectStatus.Active;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ClosedAt { get; set; }
        public int CreatedBy { get; set; }
        public User Creator { get; set; }

        public ICollection<ProjectOwner> Owners { get; set; }
        public ICollection<Document> Documents { get; set; }
    }
}