using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса для управления настройками LM Studio.
    /// </summary>
    public class LmStudioSettingsService : ILmStudioSettingsService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<LmStudioSettingsService> _logger;
        private readonly LmStudioConfig _config;

        public LmStudioSettingsService(AppDbContext context, ILogger<LmStudioSettingsService> logger, IOptions<LmStudioConfig> configOptions)
        {
            _context = context;
            _logger = logger;
            _config = configOptions.Value;
        }

        /// <summary>
        /// Инициализирует настройки из конфига, если в БД нет записи.
        /// </summary>
        private async Task EnsureSettingsExistAsync()
        {
            var exists = await _context.LmStudioSettings.AnyAsync();
            if (!exists)
            {
                var settings = new LmStudioSettings
                {
                    BaseUrl = _config.BaseUrl,
                    DefaultModel = _config.DefaultModel,
                    HealthCheckIntervalSeconds = _config.HealthCheckIntervalSeconds,
                    ModelsCachePath = _config.ModelsCachePath,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1 // системный пользователь или админ (можно завести пользователя System)
                };
                _context.LmStudioSettings.Add(settings);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Настройки LM Studio инициализированы из конфига.");
            }
        }

        public async Task<LmStudioSettingsDto> GetSettingsAsync()
        {
            await EnsureSettingsExistAsync();

            var settings = await _context.LmStudioSettings
                .Include(s => s.Updater)
                .FirstOrDefaultAsync();

            if (settings == null)
                throw new InvalidOperationException("Настройки не найдены.");

            return MapToDto(settings);
        }

        public async Task<LmStudioSettingsDto> UpdateSettingsAsync(UpdateLmStudioSettingsRequest request, int currentUserId)
        {
            var settings = await _context.LmStudioSettings.FirstOrDefaultAsync();
            if (settings == null)
                throw new InvalidOperationException("Настройки не найдены.");

            // Обновляем только переданные поля
            if (!string.IsNullOrWhiteSpace(request.BaseUrl))
                settings.BaseUrl = request.BaseUrl;

            if (!string.IsNullOrWhiteSpace(request.DefaultModel))
                settings.DefaultModel = request.DefaultModel;

            if (request.HealthCheckIntervalSeconds.HasValue && request.HealthCheckIntervalSeconds.Value > 0)
                settings.HealthCheckIntervalSeconds = request.HealthCheckIntervalSeconds.Value;

            if (!string.IsNullOrWhiteSpace(request.ModelsCachePath))
                settings.ModelsCachePath = request.ModelsCachePath;

            if (!string.IsNullOrWhiteSpace(request.AnalystModel))
                settings.AnalystModel = request.AnalystModel;
            if (!string.IsNullOrWhiteSpace(request.ArchitectModel))
                settings.ArchitectModel = request.ArchitectModel;
            if (!string.IsNullOrWhiteSpace(request.DeveloperModel))
                settings.DeveloperModel = request.DeveloperModel;
            if (!string.IsNullOrWhiteSpace(request.TesterModel))
                settings.TesterModel = request.TesterModel;                

            settings.UpdatedAt = DateTime.UtcNow;
            settings.UpdatedBy = currentUserId;

            await _context.SaveChangesAsync();

            // Загружаем навигационное свойство для DTO
            await _context.Entry(settings).Reference(s => s.Updater).LoadAsync();

            _logger.LogInformation($"Настройки LM Studio обновлены пользователем {currentUserId}");

            return MapToDto(settings);
        }

        private LmStudioSettingsDto MapToDto(LmStudioSettings settings)
        {
            return new LmStudioSettingsDto
            {
                Id = settings.Id,
                BaseUrl = settings.BaseUrl,
                DefaultModel = settings.DefaultModel,
                HealthCheckIntervalSeconds = settings.HealthCheckIntervalSeconds,
                ModelsCachePath = settings.ModelsCachePath,
                UpdatedByUsername = settings.Updater?.Username,
                UpdatedAt = settings.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                AnalystModel = settings.AnalystModel,
                ArchitectModel = settings.ArchitectModel,
                DeveloperModel = settings.DeveloperModel,
                TesterModel = settings.TesterModel,                
            };
        }
    }
}