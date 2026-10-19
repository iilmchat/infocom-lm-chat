using System;
using System.ComponentModel.DataAnnotations;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Задача разработчика, сформированная в результате декомпозиции архитектурных артефактов.
    /// </summary>
    public class DeveloperTask
    {
        /// <summary>Идентификатор задачи.</summary>
        public int Id { get; set; }

        /// <summary>Идентификатор проекта.</summary>
        public int ProjectId { get; set; }

        /// <summary>Навигационное свойство проекта.</summary>
        public Project Project { get; set; }

        /// <summary>Краткое название задачи.</summary>
        [MaxLength(200)]
        public string Title { get; set; }

        /// <summary>Подробное описание задачи.</summary>
        public string Description { get; set; }

        /// <summary>Статус задачи.</summary>
        public DeveloperTaskStatus Status { get; set; } = DeveloperTaskStatus.Pending;

        /// <summary>Порядковый номер задачи в плане (для последовательного выполнения).</summary>
        public int Order { get; set; }

        /// <summary>Комментарий владельца (список файлов, замечания и т.п.).</summary>
        public string Comment { get; set; }

        /// <summary>Сообщение об ошибке последнего выполнения (если было).</summary>
        public string ErrorMessage { get; set; }

        /// <summary>Дополнительные параметры задачи в формате JSON.</summary>
        public string ParametersJson { get; set; }

        /// <summary>Идентификатор пользователя, создавшего задачу (системный пользователь или владелец).</summary>
        public int CreatedBy { get; set; }

        /// <summary>Навигационное свойство создателя.</summary>
        public User Creator { get; set; }

        /// <summary>Дата создания задачи.</summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Дата последнего обновления задачи.</summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}