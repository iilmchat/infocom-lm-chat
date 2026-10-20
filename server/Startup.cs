// Startup.cs
using System;
using System.Threading;
using System.Threading.Tasks;
using InfocomChat.Server.Database;
using InfocomChat.Server.Hubs;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Middleware; // Добавлено

namespace InfocomChat.Server
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            // Контроллеры
            services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.PropertyNamingPolicy = null;
                    options.JsonSerializerOptions.WriteIndented = true;
                });

            //services.AddEndpointsApiExplorer();
            //services.AddSwaggerGen();

            // SignalR для реального времени
            services.AddSignalR(options =>
            {
                options.EnableDetailedErrors = true;
                options.MaximumReceiveMessageSize = 1024 * 1024; // 1MB
                options.KeepAliveInterval = System.TimeSpan.FromSeconds(15);
                options.ClientTimeoutInterval = System.TimeSpan.FromSeconds(30);
                options.HandshakeTimeout = System.TimeSpan.FromSeconds(15);
            });

            // CORS
            
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", builder =>
                {
                    // Разрешаем запросы с указанного домена
                    builder.WithOrigins(
                            "http://222.1.1.99:8033",
                            "http://222.1.1.99:8034",
                            "http://localhost:3000",
                            "http://localhost:8034"
                        )
                        // Разрешаем заголовки, которые могут быть отправлены клиентом
                        .AllowAnyHeader()
                        // Разрешаем методы HTTP, которые можно использовать
                        .AllowAnyMethod()
                    // Разрешаем передачу credentials (cookies, authorization headers)
                    .AllowCredentials()
                    //.AllowAnyOrigin();
                    .SetIsOriginAllowed(_ => true);
                });
            });
            
            // Кэширование
            services.AddMemoryCache();

            // HTTP клиент
            services.AddHttpClient();


            // Регистрация DbContext с использованием SQL Server
            // Важно: используем AddDbContext для правильной регистрации в DI контейнере
            // Инициализация базы данных            
            // БАЗА ДАННЫХ            
            services.AddDbContext<ChatDbContext>(options =>
                options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));

            // Сервисы приложения
            // СЕРВИСЫ            
            services.AddScoped<UserService>();       
            services.AddScoped<RoomManager>();
            services.AddScoped<MessageHistoryService>();
            services.AddScoped<UserPresenceService>();
            services.AddScoped<PrivateChatService>();
            services.AddScoped<ReactionService>();
            services.AddScoped<AttachmentService>();
            services.AddScoped<MentionService>();            

            services.AddScoped<AnalyticsService>();
            services.AddScoped<NotificationService>();
            services.AddScoped<SettingsService>();
            services.AddScoped<SessionService>();
            services.AddScoped<BotService>();            

            // Фоновый сервис для очистки неактивных комнат
            //services.AddHostedService<RoomCleanupService>();
            // Фоновый сервис для очистки неактивных комнат - нужно изменить реализацию
            // Вместо регистрации как Singleton, используем фабрику или отдельный подход
            // Решение: создаем IHostedService через фабрику или используем Scoped-сервисы правильно
            // Фоновый сервис очистки            
            services.AddHostedService<RoomCleanupService>();

            // Если нужно, можно добавить фоновую очистку уведомлений и сессий
            services.AddHostedService<NotificationCleanupService>(); // новый фоновый сервис
            services.AddHostedService<SessionCleanupService>(); // новый фоновый сервис
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            // Глобальная обработка ошибок (добавлено)
            app.UseMiddleware<ErrorHandlingMiddleware>();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseExceptionHandler("/error");
                app.UseHsts();
            }

            app.UseCors("AllowAll");

            app.UseRouting();

            // Статические файлы
            app.UseDefaultFiles();
            app.UseStaticFiles();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
                endpoints.MapHub<ChatHub>("/chatHub");
            });

            // Инициализация БД
            using (var scope = app.ApplicationServices.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
                dbContext.Database.EnsureCreated();
            }
        }
    }

    /// <summary>
    /// Фоновый сервис для очистки неактивных комнат
    /// </summary>
    public class RoomCleanupService : BackgroundService
    {
        // Изменяем реализацию - используем IServiceScopeFactory для получения Scoped-сервисов
        private readonly ILogger<RoomCleanupService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public RoomCleanupService(
            ILogger<RoomCleanupService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Room cleanup service started.");
            
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Создаем новый scope для получения Scoped-сервисов внутри BackgroundService");
                    // Создаем новый scope для получения Scoped-сервисов внутри BackgroundService
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var roomManager = scope.ServiceProvider.GetRequiredService<RoomManager>();
                        _logger.LogInformation("scope.ServiceProvider.GetRequiredService<RoomManager>();");
                        var presenceService = scope.ServiceProvider.GetRequiredService<UserPresenceService>();

                        // Очистка неактивных пользователей
                        await presenceService.CleanupInactiveUsersAsync();

                        _logger.LogInformation("Room cleanup completed");
                    }

                    // Ждем 5 минут перед следующим выполнением
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during room cleanup");
                }
            }
        }
    }
}