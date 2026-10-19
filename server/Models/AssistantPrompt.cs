using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Системный промт для конкретного типа ИИ-ассистента.
    /// </summary>
    public class AssistantPrompt
    {
        public int Id { get; set; }

        /// <summary>Тип ассистента: Architect, Analyst, Developer, Tester</summary>
        public string AssistantType { get; set; }

        /// <summary>Системный промт (текст)</summary>
        public string SystemPrompt { get; set; }

        /// <summary>Дата последнего обновления</summary>
        public DateTime UpdatedAt { get; set; }

        /// <summary>Кто обновил (ID пользователя)</summary>
        public int UpdatedBy { get; set; }

        public User Updater { get; set; }
    }
}