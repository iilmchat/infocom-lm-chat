// Services/SessionCleanupService.cs
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    public class SessionCleanupService : BackgroundService
    {
        private readonly ILogger<SessionCleanupService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public SessionCleanupService(ILogger<SessionCleanupService> logger, IServiceScopeFactory scopeFactory)
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
                    var sessionService = scope.ServiceProvider.GetRequiredService<SessionService>();
                    var count = await sessionService.CleanupExpiredSessionsAsync();
                    if (count > 0)
                        _logger.LogInformation($"Очищено {count} просроченных сессий");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка очистки сессий");
                }

                await Task.Delay(TimeSpan.FromHours(6), stoppingToken); // раз в 6 часов
            }
        }
    }
}