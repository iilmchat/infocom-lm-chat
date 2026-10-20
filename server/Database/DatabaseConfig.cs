// Database/DatabaseConfig.cs

using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Database
{
    /// <summary>
    /// Конфигурация базы данных
    /// </summary>
    public static class DatabaseConfig
    {
        /// <summary>
        /// Тип базы данных
        /// </summary>
        public enum DatabaseType
        {
            SQLite,
            SqlServer,
            PostgreSQL
        }

        /// <summary>
        /// Настройки базы данных из конфигурации
        /// </summary>
        public class DatabaseSettings
        {
            public DatabaseType Type { get; set; } = DatabaseType.SqlServer;
            public string ConnectionString { get; set; }
            public string SQLitePath { get; set; } = "Data/chat.db";
            public bool AutoMigrate { get; set; } = true;
            public int CommandTimeout { get; set; } = 30;
            public bool EnableSensitiveDataLogging { get; set; } = false;
        }

        /// <summary>
        /// Загрузка настроек из appsettings.json
        /// </summary>
        public static DatabaseSettings LoadSettings(IConfiguration configuration)
        {
            var settings = new DatabaseSettings();
            var dbSection = configuration.GetSection("Database");

            if (dbSection.Exists())
            {
                var typeStr = dbSection.GetValue<string>("Type") ?? "SQLite";
                settings.Type = Enum.TryParse<DatabaseType>(typeStr, true, out var type) ? type : DatabaseType.SqlServer;
                settings.ConnectionString = dbSection.GetValue<string>("ConnectionString");
                settings.SQLitePath = dbSection.GetValue<string>("SQLitePath") ?? "Data/chat.db";
                settings.AutoMigrate = dbSection.GetValue<bool>("AutoMigrate", true);
                settings.CommandTimeout = dbSection.GetValue<int>("CommandTimeout", 30);
                settings.EnableSensitiveDataLogging = dbSection.GetValue<bool>("EnableSensitiveDataLogging", false);
            }

            return settings;
        }

        /// <summary>
        /// Получение строки подключения на основе настроек
        /// </summary>
        public static string GetConnectionString(DatabaseSettings settings)
        {
            if (!string.IsNullOrEmpty(settings.ConnectionString))
            {
                return settings.ConnectionString;
            }

            return settings.Type switch
            {
                DatabaseType.SQLite => $"Data Source={settings.SQLitePath};",
                DatabaseType.SqlServer => "Server=222.1.1.99;Database=InfocomChat;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;",
                DatabaseType.PostgreSQL => "Host=localhost;Database=InfocomChat;Username=postgres;Password=postgres;",
                _ => "Server=222.1.1.99;Database=InfocomChat;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;"
            };
        }

        /// <summary>
        /// Добавление контекста базы данных в сервисы
        /// </summary>
        public static IServiceCollection AddDatabase(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var settings = LoadSettings(configuration);
            var connectionString = GetConnectionString(settings);

            services.AddSingleton(settings);

            services.AddDbContext<ChatDbContext>((serviceProvider, options) =>
            {
                // Используем нужный провайдер БД
                switch (settings.Type)
                {
                    case DatabaseType.SqlServer:
                        options.UseSqlServer(connectionString, sqlOptions =>
                            sqlOptions.CommandTimeout(settings.CommandTimeout));
                        break;
                    //case DatabaseType.PostgreSQL:
                    //    options.UseNpgsql(connectionString, npgsqlOptions =>
                    //        npgsqlOptions.CommandTimeout(settings.CommandTimeout));
                    //    break;
                    //case DatabaseType.SQLite:
                    //    options.UseSqlite(connectionString, sqliteOptions =>
                    //        sqliteOptions.CommandTimeout(settings.CommandTimeout));
                    //    break;
                    default:
                        // По умолчанию используем SQL Server
                        options.UseSqlServer(connectionString, sqlOptions =>
                            sqlOptions.CommandTimeout(settings.CommandTimeout));
                        break;
                }

                // Включаем логирование чувствительных данных при необходимости
                if (settings.EnableSensitiveDataLogging)
                {
                    options.EnableSensitiveDataLogging();
                }
            });

            return services;
        }
        /*
        /// <summary>
        /// Добавление контекста базы данных в сервисы
        /// </summary>
        public static IServiceCollection AddDatabase(
            this IServiceCollection services, 
            IConfiguration configuration)
        {
            var settings = LoadSettings(configuration);
            var connectionString = GetConnectionString(settings);

            services.AddSingleton(settings);

            services.AddDbContext<ChatDbContext>((serviceProvider, options) =>
            {
                options.UseDatabase(settings.Type, connectionString);
                options.CommandTimeout(settings.CommandTimeout);

                if (settings.EnableSensitiveDataLogging)
                {
                    options.EnableSensitiveDataLogging();
                }
            });

            return services;
        }
        */
        /*
        /// <summary>
        /// Настройка Use для конкретной СУБД
        /// </summary>
        public static DbContextOptionsBuilder UseDatabase(
            this DbContextOptionsBuilder options, 
            DatabaseType dbType, 
            string connectionString)
        {
            return dbType switch
            {
                //DatabaseType.SQLite => options.UseSqlite(connectionString),
                DatabaseType.SqlServer => options.UseSqlServer(connectionString),
                //DatabaseType.PostgreSQL => options.UseNpgsql(connectionString),
                _ => options.UseSqlServer(connectionString)
            };
        }
        */
        /// <summary>
        /// Настройка Use для конкретной СУБД
        /// </summary>
        public static DbContextOptionsBuilder UseDatabase(
            this DbContextOptionsBuilder options,
            DatabaseType dbType,
            string connectionString)
        {
            // Этот метод больше не используется в текущей реализации,
            // но оставлен для совместимости, если где-то ещё вызывается
            return dbType switch
            {
                DatabaseType.SqlServer => options.UseSqlServer(connectionString),
                //DatabaseType.PostgreSQL => options.UseNpgsql(connectionString),
                //DatabaseType.SQLite => options.UseSqlite(connectionString),
                _ => options.UseSqlServer(connectionString)
            };
        }

        /// <summary>
        /// Применение миграций при старте
        /// </summary>
        public static async Task EnsureDatabaseCreatedAsync(IServiceProvider serviceProvider)
        {
            var settings = serviceProvider.GetRequiredService<DatabaseSettings>();
            
            if (!settings.AutoMigrate)
            {
                return;
            }

            using var scope = serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            try
            {
                await context.Database.EnsureCreatedAsync();
                
                // Проверяем, есть ли системные настройки
                var settingsCount = await context.SystemSettings.CountAsync();
                if (settingsCount == 0)
                {
                    await SeedSystemSettingsAsync(context);
                }

                // Проверяем, есть ли администратор
                var adminExists = await context.Users.AnyAsync(u => u.Role == "Admin");
                if (!adminExists)
                {
                    await SeedAdminUserAsync(context);
                }

                // Проверяем, есть ли общая комната
                var commonRoomExists = await context.Rooms.AnyAsync(r => r.RoomType == "common");
                if (!commonRoomExists)
                {
                    await SeedCommonRoomAsync(context);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при инициализации базы данных: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Инициализация системных настроек
        /// </summary>
        private static async Task SeedSystemSettingsAsync(ChatDbContext context)
        {
            var settings = new[]
            {
                new SystemSetting 
                { 
                    Key = "DefaultRole", 
                    Value = "User",
                    Description = "Роль по умолчанию для новых пользователей"
                },
                new SystemSetting 
                { 
                    Key = "MaxUsersPerRoom", 
                    Value = "50",
                    Description = "Максимальное количество пользователей в комнате"
                },
                new SystemSetting 
                { 
                    Key = "MaxMessageLength", 
                    Value = "10000",
                    Description = "Максимальная длина сообщения"
                },
                new SystemSetting 
                { 
                    Key = "InactiveTimeoutMinutes", 
                    Value = "5",
                    Description = "Таймаут неактивности в минутах"
                },
                new SystemSetting 
                { 
                    Key = "MaxHistoryMessages", 
                    Value = "1000",
                    Description = "Максимальное количество сообщений в истории"
                },
                new SystemSetting 
                { 
                    Key = "AllowGuestUsers", 
                    Value = "true",
                    Description = "Разрешены ли гостевые пользователи"
                },
                new SystemSetting 
                { 
                    Key = "EnableRegistration", 
                    Value = "true",
                    Description = "Разрешена ли регистрация новых пользователей"
                }
            };

            await context.SystemSettings.AddRangeAsync(settings);
            await context.SaveChangesAsync();
        }

        /// <summary>
        /// Создание администратора по умолчанию
        /// </summary>
        private static async Task SeedAdminUserAsync(ChatDbContext context)
        {
            var admin = new User
            {
                UserId = "admin_" + Guid.NewGuid().ToString().Substring(0, 8),
                Name = "Administrator",
                Avatar = "🛡️",
                AvatarType = "emoji",
                Color = "#ffd700",
                Role = "Admin",
                IsOnline = false,
                Status = "offline",
                CreatedAt = DateTime.UtcNow,
                LastSeen = DateTime.UtcNow
            };

            await context.Users.AddAsync(admin);
            await context.SaveChangesAsync();
        }

        /// <summary>
        /// Создание общей комнаты по умолчанию
        /// </summary>
        private static async Task SeedCommonRoomAsync(ChatDbContext context)
        {
            var commonRoom = new Room
            {
                RoomId = "common_" + Guid.NewGuid().ToString().Substring(0, 8),
                Name = "Общая комната",
                Description = "Общая комната для всех пользователей",
                CreatedBy = "system",
                IsPrivate = false,
                RoomType = "common",
                IsActive = true,
                Model = "local-model"
            };

            await context.Rooms.AddAsync(commonRoom);
            await context.SaveChangesAsync();
        }
    }
}