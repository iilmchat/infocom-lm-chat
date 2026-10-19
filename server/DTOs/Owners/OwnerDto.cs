using System;

namespace ProjectManager.API.DTOs
{
    public class OwnerDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; }
        public DateTime AssignedAt { get; set; }
    }
}