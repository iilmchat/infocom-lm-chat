using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на создание новой версии документа
    /// </summary>
    public class CreateDocumentRequest
    {
        [Required(ErrorMessage = "Тип документа обязателен")]
        [RegularExpression(@"^(ИД|Проект|ТТ|ПиМ ПСИ|ЦБИ|ИТ|СП|СФС|ЭР|ERR_ИТ|ERR_СП|ERR_СФС|ERR_ЭР|ERR)$", ErrorMessage = "Недопустимый тип документа")]
        public string Type { get; set; }

        [MaxLength(200, ErrorMessage = "Заголовок не должен превышать 200 символов")]
        public string Title { get; set; }

        [Required(ErrorMessage = "Содержимое документа обязательно")]
        public string Content { get; set; }
    }
}