using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    public class ProjectCreateRequest
    {
        [Required, MinLength(1), MaxLength(200)]
        public string Name { get; set; }
    }
}