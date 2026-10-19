using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на обновление черновика документа
    /// </summary>
    public class UpdateDocumentRequest
    {
        [MaxLength(200, ErrorMessage = "Заголовок не должен превышать 200 символов")]
        public string Title { get; set; }

        [Required(ErrorMessage = "Содержимое документа обязательно")]
        public string Content { get; set; }
    }
}