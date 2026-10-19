using System;
using ProjectManager.API.Models;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// DTO задачи разработчика.
    /// </summary>
    public class DeveloperTaskDto
    {
        /// <summary>Идентификатор задачи.</summary>
        public int Id { get; set; }

        /// <summary>Идентификатор проекта.</summary>
        public int ProjectId { get; set; }

        /// <summary>Название задачи.</summary>
        public string Title { get; set; }

        /// <summary>Описание задачи.</summary>
        public string Description { get; set; }

        /// <summary>Статус задачи.</summary>
        public DeveloperTaskStatus Status { get; set; }

        /// <summary>Порядковый номер в плане.</summary>
        public int Order { get; set; }

        /// <summary>Комментарий владельца.</summary>
        public string Comment { get; set; }

        /// <summary>Сообщение об ошибке.</summary>
        public string ErrorMessage { get; set; }

        /// <summary>Дополнительные параметры (JSON).</summary>
        public string ParametersJson { get; set; }

        /// <summary>Дата создания.</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Дата последнего обновления.</summary>
        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>
    /// Запрос на обновление задачи разработчика (ручная корректировка владельцем).
    /// </summary>
    public class UpdateDeveloperTaskRequest
    {
        /// <summary>Новое название задачи (опционально).</summary>
        public string Title { get; set; }

        /// <summary>Новое описание задачи (опционально).</summary>
        public string Description { get; set; }

        /// <summary>Новый порядковый номер (опционально).</summary>
        public int? Order { get; set; }

        /// <summary>Комментарий владельца (опционально).</summary>
        public string Comment { get; set; }
    }

    /// <summary>
    /// Запрос на отклонение задачи с комментарием.
    /// </summary>
    public class RejectDeveloperTaskRequest
    {
        /// <summary>Комментарий с ошибками и недочётами.</summary>
        public string Comment { get; set; }
    }
}