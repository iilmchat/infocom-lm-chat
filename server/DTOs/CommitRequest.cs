using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на выполнение git commit.
    /// </summary>
    public class CommitRequest
    {
        [Required(ErrorMessage = "Сообщение коммита обязательно")]
        public string Message { get; set; }
    }
}