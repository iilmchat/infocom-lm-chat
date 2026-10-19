using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на сохранение файла в проекте.
    /// </summary>
    public class SaveCodeRequest
    {
        [Required(ErrorMessage = "Путь к файлу обязателен")]
        public string Path { get; set; }

        [Required(ErrorMessage = "Содержимое файла обязательно")]
        public string Content { get; set; }
    }
}