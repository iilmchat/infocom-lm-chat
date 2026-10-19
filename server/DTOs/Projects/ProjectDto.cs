using System;
using System.Collections.Generic;
using ProjectManager.API.Models;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Ответ с информацией о проекте (для списка и деталей)
    /// </summary>
    public class ProjectDto
    {
        /*
        public int Id { get; set; }
        public string Name { get; set; }
        public ProjectStatus Status { get; set; } // 0 - Active, 1 - Closed
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int CreatedBy { get; set; }
        public string CreatorName { get; set; }
        */

        public int Id { get; set; }
        public string Name { get; set; }
        public ProjectStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public int CreatedBy { get; set; }
        public string CreatorName { get; set; }  
              
        // Список владельцев (только ID и имена)
        //public List<OwnerDto> Owners { get; set; } = new List<OwnerDto>();
        /// <summary>Список владельцев проекта.</summary>
        public List<OwnerDto> Owners { get; set; } = new List<OwnerDto>();
    }
/*
    public class OwnerDto1
    {
        public int Id { get; set; }
        public string Username { get; set; }
    }
*/
}