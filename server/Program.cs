// Program.cs
using InfocomChat.Server.Database;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using System.Collections.Concurrent;
using System.IO;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Services;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Logging.Debug;

namespace InfocomChat.Server
{
    public class Program
    {
        public static void Main(string[] args)
        {
             CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureLogging((context, logging) =>
                {
                    logging.ClearProviders();
                    
                    // Консольное логирование
                    logging.AddConsole();
                    
                    // Отладочное логирование
                    logging.AddDebug();
                    //logging.SetMinimumLevel(LogLevel.Information);
                    
                    // Асинхронное логирование в файл
                    var logPath = Path.Combine("logs", $"app-{DateTime.Now:yyyy-MM-dd}.log");
                    
                    // Создаём директорию, если её нет
                    var logDirectory = Path.GetDirectoryName(logPath);
                    if (!Directory.Exists(logDirectory))
                    {
                        Directory.CreateDirectory(logDirectory);
                    }

                    logging.AddProvider(new AsyncFileLoggerProvider(logPath));

                    // Уровень логирования
                    var logLevel = context.Configuration.GetValue<LogLevel>("Logging:LogLevel:Default", LogLevel.Information);
                    logging.SetMinimumLevel(logLevel);
                    
                    // Фильтры для конкретных категорий
                    logging.AddFilter("Microsoft", LogLevel.Warning);
                    logging.AddFilter("Microsoft.Hosting.Lifetime", LogLevel.Information);
                    logging.AddFilter("System", LogLevel.Warning);                    
                })
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                    webBuilder.UseIISIntegration();
                    webBuilder.UseIIS();
                    
                    // Для локальной разработки
                     webBuilder.UseUrls("http://127.0.0.1:8032");
                });
    }

    /// <summary>
    /// Провайдер асинхронного логирования в файл
    /// </summary>
    public class AsyncFileLoggerProvider : ILoggerProvider
    {
        private readonly string _logFilePath;
        private readonly BlockingCollection<string> _queue = new BlockingCollection<string>(new ConcurrentQueue<string>());
        private readonly Task _worker;
        private readonly object _lock = new object();
        private bool _disposed;

        public AsyncFileLoggerProvider(string logFilePath)
        {
            _logFilePath = logFilePath;
            _worker = Task.Run(ProcessQueue);
        }

        private async Task ProcessQueue()
        {
            foreach (var entry in _queue.GetConsumingEnumerable())
            {
                try
                {
                    await File.AppendAllTextAsync(_logFilePath, entry + Environment.NewLine);

                    // Ограничение размера файла (100 МБ)
                    var fileInfo = new FileInfo(_logFilePath);
                    if (fileInfo.Exists && fileInfo.Length > 100 * 1024 * 1024)
                    {
                        var archivePath = _logFilePath.Replace(".log", $"-{DateTime.Now:HH-mm-ss}.log");
                        File.Move(_logFilePath, archivePath);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Ошибка записи лога: {ex.Message}");
                }
            }
        }

        public ILogger CreateLogger(string categoryName)
        {
            return new AsyncFileLogger(categoryName, _queue);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _queue.CompleteAdding();
            _worker.Wait(TimeSpan.FromSeconds(10));
            _queue.Dispose();
        }
    }

    /// <summary>
    /// Асинхронный логгер с записью в очередь
    /// </summary>
    public class AsyncFileLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly BlockingCollection<string> _queue;

        public AsyncFileLogger(string categoryName, BlockingCollection<string> queue)
        {
            _categoryName = categoryName;
            _queue = queue;
        }

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            var message = formatter(state, exception);
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
            var logEntry = $"[{timestamp}] [{logLevel}] [{_categoryName}] {message}";

            if (exception != null)
            {
                logEntry += $"\nException: {exception}\nStack Trace: {exception.StackTrace}";
                if (exception.InnerException != null)
                    logEntry += $"\nInner Exception: {exception.InnerException}";
            }

            _queue.Add(logEntry);
        }
    }
    
    /// <summary>
    /// Провайдер  логирования в файл
    /// </summary>        
    public class FileLoggerProvider : ILoggerProvider
    {
        private readonly string _logFilePath;
        private readonly object _lock = new object();

        public FileLoggerProvider(string logFilePath)
        {
            _logFilePath = logFilePath;
        }

        public ILogger CreateLogger(string categoryName)
        {
            return new FileLogger(_logFilePath, categoryName, _lock);
        }

        public void Dispose() { }
    }        

    /// <summary>
    /// Логгер с записью в файл
    /// </summary>
    public class FileLogger : ILogger
    {
        private readonly string _logFilePath;
        private readonly string _categoryName;
        private readonly object _lock;

        public FileLogger(string logFilePath, string categoryName, object lockObj)
        {
            _logFilePath = logFilePath;
            _categoryName = categoryName;
            _lock = lockObj;
        }

        public IDisposable BeginScope<TState>(TState state) where TState : notnull
        {
            return null;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return logLevel >= LogLevel.Information;
        }

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception exception, Func<TState, Exception, string> formatter)
        {
            if (!IsEnabled(logLevel))
                return;

            lock (_lock)
            {
                try
                {
                    var message = formatter(state, exception);
                    var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                    var logEntry = $"[{timestamp}] [{logLevel}] [{_categoryName}] {message}";

                    if (exception != null)
                    {
                        logEntry += $"\nException: {exception}\nStack Trace: {exception.StackTrace}";
                        if (exception.InnerException != null)
                        {
                            logEntry += $"\nInner Exception: {exception.InnerException}";
                        }
                    }

                    File.AppendAllText(_logFilePath, logEntry + Environment.NewLine);

                    // Ограничиваем размер файла (100MB)
                    var fileInfo = new FileInfo(_logFilePath);
                    if (fileInfo.Exists && fileInfo.Length > 100 * 1024 * 1024) // 100 MB
                    {
                        var archivePath = _logFilePath.Replace(".log", $"-{DateTime.Now:HH-mm-ss}.log");
                        File.Move(_logFilePath, archivePath);
                    }
                }
                catch (Exception ex)
                {
                    // Если не удалось записать в файл, игнорируем ошибку
                    Console.WriteLine($"Ошибка записи лога в файл: {ex.Message}");
                }
            }
        }
    }
}