using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Настройки подключения к LM Studio, хранящиеся в БД.
    /// </summary>
    public class LmStudioSettings
    {
        public int Id { get; set; }

        /// <summary>Базовый URL сервера LM Studio (например, http://222.1.1.31:8034).</summary>
        public string BaseUrl { get; set; }

        /// <summary>Модель, используемая по умолчанию.</summary>
        public string DefaultModel { get; set; }

        /// <summary>Интервал проверки доступности в секундах.</summary>
        public int HealthCheckIntervalSeconds { get; set; }

        /// <summary>Путь к файлу кэша списка моделей (относительный или абсолютный).</summary>
        public string ModelsCachePath { get; set; }

        /// <summary>Модель для ассистента-аналитика (если null, используется DefaultModel).</summary>
        public string AnalystModel { get; set; }

        /// <summary>Модель для ассистента-архитектора (если null, используется DefaultModel).</summary>
        public string ArchitectModel { get; set; }

        /// <summary>Модель для ассистента-разработчика (если null, используется DefaultModel).</summary>
        public string DeveloperModel { get; set; }

        /// <summary>Модель для ассистента-тестировщика (если null, используется DefaultModel).</summary>
        public string TesterModel { get; set; }

        /// <summary>Дата последнего обновления настроек.</summary>
        public DateTime UpdatedAt { get; set; }

        /// <summary>Кто обновил настройки (ID пользователя).</summary>
        public int UpdatedBy { get; set; }
        
        public User Updater { get; set; }
    }
}