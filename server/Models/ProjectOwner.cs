using System;

namespace ProjectManager.API.Models
{
    public class ProjectOwner
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public Project Project { get; set; }
        public int UserId { get; set; }
        public User User { get; set; }
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    }
}