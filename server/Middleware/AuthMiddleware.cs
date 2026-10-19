using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Middleware
{
    /// <summary>
    /// Middleware для проверки токена сессии и установки пользователя в HttpContext
    /// </summary>
    public class AuthMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<AuthMiddleware> _logger;

        public AuthMiddleware(RequestDelegate next, ILogger<AuthMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, ISessionService sessionService)
        {
            // Пытаемся получить токен из заголовка Authorization
            string token = null;
            if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                var parts = authHeader.ToString().Split(' ');
                if (parts.Length == 2 && parts[0].Equals("Bearer", StringComparison.OrdinalIgnoreCase))
                {
                    token = parts[1];
                }
            }

            if (!string.IsNullOrEmpty(token))
            {
                try
                {
                    // Проверяем валидность токена в БД
                    var userId = await sessionService.GetUserIdByTokenAsync(token);
                    if (userId.HasValue)
                    {
                        // Создаём ClaimsPrincipal для авторизации
                        var claims = new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                            // Роль пока не храним в токене, будем получать из БД при необходимости
                        };
                        var identity = new ClaimsIdentity(claims, "CustomToken");
                        var principal = new ClaimsPrincipal(identity);
                        context.User = principal;

                        // Также сохраняем userId в Items для быстрого доступа
                        context.Items["UserId"] = userId.Value;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Ошибка проверки токена");
                }
            }

            await _next(context);
        }
    }
}