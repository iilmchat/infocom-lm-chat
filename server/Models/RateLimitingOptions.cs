namespace ProjectManager.API.Models
{
    /// <summary>
    /// Настройки ограничения частоты запросов.
    /// </summary>
    public class RateLimitingOptions
    {
        /// <summary>Максимальное количество запросов за окно.</summary>
        public int MaxRequests { get; set; } = 10;

        /// <summary>Длина окна в секундах.</summary>
        public int TimeWindowSeconds { get; set; } = 60;
    }
}