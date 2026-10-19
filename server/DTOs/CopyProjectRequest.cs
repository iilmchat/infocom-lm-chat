using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Запрос на копирование проекта.
    /// </summary>
    public class CopyProjectRequest
    {
        /// <summary>
        /// Новое имя для копии (если не указано, генерируется автоматически).
        /// </summary>
        [MaxLength(200, ErrorMessage = "Название не должно превышать 200 символов")]
        public string NewName { get; set; }
    }
}