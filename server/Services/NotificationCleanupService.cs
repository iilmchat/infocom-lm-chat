// Services/NotificationCleanupService.cs
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    public class NotificationCleanupService : BackgroundService
    {
        private readonly ILogger<NotificationCleanupService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public NotificationCleanupService(ILogger<NotificationCleanupService> logger, IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();
                    var count = await notificationService.CleanupOldNotificationsAsync(30); // 30 дней
                    if (count > 0)
                        _logger.LogInformation($"Очищено {count} старых уведомлений");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка очистки уведомлений");
                }

                await Task.Delay(TimeSpan.FromDays(1), stoppingToken); // раз в сутки
            }
        }
    }
}