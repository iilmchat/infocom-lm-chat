using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на добавление владельца
    /// </summary>
    public class AddOwnerRequest
    {
        [Required]
        public int UserId { get; set; }
    }
}