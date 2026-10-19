namespace ProjectManager.API.Models
{
    /// <summary>
    /// Настройки LM Studio из appsettings.json (используются для инициализации БД).
    /// </summary>
    public class LmStudioConfig
    {
        public string BaseUrl { get; set; }
        public string DefaultModel { get; set; }
        public int HealthCheckIntervalSeconds { get; set; }
        public string ModelsCachePath { get; set; }
    }
}