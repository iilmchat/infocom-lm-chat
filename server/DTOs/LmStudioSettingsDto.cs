namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// DTO для настроек LM Studio (чтение и обновление).
    /// </summary>
    public class LmStudioSettingsDto
    {
        public int Id { get; set; }
        public string BaseUrl { get; set; }
        public string DefaultModel { get; set; }
        public int HealthCheckIntervalSeconds { get; set; }
        public string ModelsCachePath { get; set; }
        public string AnalystModel { get; set; }
        public string ArchitectModel { get; set; }
        public string DeveloperModel { get; set; }
        public string TesterModel { get; set; }
        public string UpdatedByUsername { get; set; }
        public string UpdatedAt { get; set; } // в виде строки для удобства
    }

    /// <summary>
    /// Запрос на обновление настроек LM Studio.
    /// </summary>
    public class UpdateLmStudioSettingsRequest
    {
        public string BaseUrl { get; set; }
        public string DefaultModel { get; set; }
        public int? HealthCheckIntervalSeconds { get; set; }
        public string ModelsCachePath { get; set; }
        public string AnalystModel { get; set; }
        public string ArchitectModel { get; set; }
        public string DeveloperModel { get; set; }
        public string TesterModel { get; set; }
    }
}