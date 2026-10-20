// Middleware/ErrorHandlingMiddleware.cs
using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Middleware
{
    /// <summary>
    /// Промежуточное ПО для глобальной обработки исключений
    /// </summary>
    public class ErrorHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlingMiddleware> _logger;

        public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Необработанное исключение в приложении");
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;

            var response = new
            {
                error = "Внутренняя ошибка сервера",
                detail = exception.Message // в разработке можно включить, в production убрать
            };

            return context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}