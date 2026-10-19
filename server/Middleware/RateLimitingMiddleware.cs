using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using ProjectManager.API.Models;

namespace ProjectManager.API.Middleware
{
    /// <summary>
    /// Middleware для ограничения частоты запросов к чувствительным эндпоинтам (например, аутентификация).
    /// </summary>
    public class RateLimitingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IMemoryCache _cache;
        private readonly int _maxRequests;
        private readonly TimeSpan _timeWindow;
        private readonly RateLimitingOptions _options;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="RateLimitingMiddleware"/>.
        /// </summary>
        /// <param name="next">Следующий делегат в конвейере.</param>
        /// <param name="cache">Сервис кэширования в памяти.</param>
        /// <param name="maxRequests">Максимальное количество запросов за окно.</param>
        /// <param name="timeWindowSeconds">Длина окна в секундах.</param>
        public RateLimitingMiddleware(RequestDelegate next, IMemoryCache cache, IOptions<RateLimitingOptions> options, int maxRequests = 10, int timeWindowSeconds = 60)
        {
            _next = next;
            _cache = cache;
            _options = options.Value;
            _maxRequests = maxRequests;
            _timeWindow = TimeSpan.FromSeconds(timeWindowSeconds);
        }

        /// <summary>
        /// Обрабатывает запрос, применяя ограничение частоты.
        /// </summary>
        /// <param name="context">HttpContext текущего запроса.</param>
        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant();
            if (path != null && (path.Contains("/api/auth/login") || path.Contains("/api/auth/register")))
            {
                var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var cacheKey = $"rate_{ipAddress}";
                var timeWindow = TimeSpan.FromSeconds(_options.TimeWindowSeconds);

                if (!_cache.TryGetValue(cacheKey, out int requestCount))
                {
                    requestCount = 0;
                }

                if (requestCount >= _options.MaxRequests)
                {
                    context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.Response.ContentType = "application/json";
                    var errorResponse = new { success = false, message = "Слишком много запросов. Попробуйте позже." };
                    await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
                    return;
                }

                requestCount++;
                _cache.Set(cacheKey, requestCount, timeWindow);
            }

            await _next(context);
        }
    }
}