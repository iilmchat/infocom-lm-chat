using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Фоновый сервис для периодической проверки доступности LM Studio и обновления кэша моделей.
    /// </summary>
    public class LmStudioHealthCheckService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LmStudioHealthCheckService> _logger;
        private readonly IHostEnvironment _hostEnvironment; // новая зависимость

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioHealthCheckService"/>.
        /// </summary>
        /// <param name="serviceProvider">Провайдер служб.</param>
        /// <param name="logger">Логгер.</param>
        /// <param name="hostEnvironment">Окружение хостинга для определения корневого пути.</param>
        public LmStudioHealthCheckService(
            IServiceProvider serviceProvider,
            ILogger<LmStudioHealthCheckService> logger,
            IHostEnvironment hostEnvironment)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _hostEnvironment = hostEnvironment;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _serviceProvider.CreateScope();
                    var settingsService = scope.ServiceProvider.GetRequiredService<ILmStudioSettingsService>();
                    var client = scope.ServiceProvider.GetRequiredService<ILmStudioClient>();

                    var settings = await settingsService.GetSettingsAsync();
                    if (settings == null)
                    {
                        _logger.LogWarning("Настройки LM Studio не найдены, проверка отложена.");
                        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                        continue;
                    }

                    // Проверяем здоровье
                    var isHealthy = await client.IsHealthyAsync();
                    if (isHealthy)
                    {
                        _logger.LogInformation("LM Studio доступен, обновляем кэш моделей.");
                        try
                        {
                            var models = await client.GetAvailableModelsAsync();
                            await SaveModelsCacheAsync(settings.ModelsCachePath, models);
                            _logger.LogInformation("Кэш моделей обновлён, найдено {Count} моделей.", models.Count);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Ошибка при получении списка моделей");
                        }
                    }
                    else
                    {
                        _logger.LogWarning("LM Studio недоступен.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка в фоновом сервисе проверки LM Studio");
                }

                // Ждём интервал из настроек
                await Task.Delay(TimeSpan.FromSeconds(await GetIntervalSecondsAsync()), stoppingToken);
            }
        }

        private async Task<int> GetIntervalSecondsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var settingsService = scope.ServiceProvider.GetRequiredService<ILmStudioSettingsService>();
            var settings = await settingsService.GetSettingsAsync();
            return settings?.HealthCheckIntervalSeconds ?? 60;
        }

        /// <summary>
        /// Сохраняет список моделей в JSON-файл по абсолютному пути.
        /// </summary>
        /// <param name="cachePath">Относительный путь к файлу кэша.</param>
        /// <param name="models">Список моделей.</param>
        private async Task SaveModelsCacheAsync(string cachePath, List<string> models)
        {
            if (string.IsNullOrWhiteSpace(cachePath))
                cachePath = "Data/ModelsCache.json";

            // Создаём папку, если её нет
            // Преобразуем относительный путь в абсолютный на основе корня приложения
            var fullPath = Path.Combine(_hostEnvironment.ContentRootPath, cachePath);

            var directory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                Directory.CreateDirectory(directory);

            var json = JsonSerializer.Serialize(models);
            await File.WriteAllTextAsync(fullPath, json);
        }
    }
}