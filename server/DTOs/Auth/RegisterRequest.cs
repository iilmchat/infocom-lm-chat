using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    public class RegisterRequest
    {
        [Required, MinLength(3), MaxLength(50)]
        public string Username { get; set; }

        [Required, MinLength(6)]
        public string Password { get; set; }
    }
}