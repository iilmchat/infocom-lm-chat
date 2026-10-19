using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    public class LoginRequest
    {
        [Required] public string Username { get; set; }
        [Required] public string Password { get; set; }
    }
}