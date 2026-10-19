using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    public class EndSessionRequest
    {
        [Required] public int UserId { get; set; }
    }
}