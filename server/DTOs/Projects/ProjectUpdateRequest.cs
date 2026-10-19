using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    public class ProjectUpdateRequest
    {
        [Required, MinLength(1), MaxLength(200)]
        public string Name { get; set; }
    }
}