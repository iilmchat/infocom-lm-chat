using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using System;
using System.Text.Json;
using System.Threading.Tasks;
using ProjectManager.API.Models;

namespace ProjectManager.API.Middleware
{
    public class RateLimitingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IMemoryCache _cache;
        private readonly RateLimitingOptions _options;

        public RateLimitingMiddleware(RequestDelegate next, IMemoryCache cache, IOptions<RateLimitingOptions> options)
        {
            _next = next;
            _cache = cache;
            _options = options.Value;
        }

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