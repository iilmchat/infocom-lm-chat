using Microsoft.AspNetCore.Http;
using System;
using System.Text.Json;
using System.Threading.Tasks;

namespace ProjectManager.API.Middleware
{
    /// <summary>
    /// Middleware для ограничения размера тела запроса.
    /// </summary>
    public class RequestSizeLimitMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly long _maxBodySizeBytes;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="RequestSizeLimitMiddleware"/>.
        /// </summary>
        /// <param name="next">Следующий делегат в конвейере.</param>
        /// <param name="maxBodySizeBytes">Максимальный размер тела в байтах.</param>
        public RequestSizeLimitMiddleware(RequestDelegate next, long maxBodySizeBytes = 5 * 1024 * 1024)
        {
            _next = next;
            _maxBodySizeBytes = maxBodySizeBytes;
        }

        /// <summary>
        /// Проверяет размер тела запроса и отклоняет слишком большие.
        /// </summary>
        /// <param name="context">HttpContext текущего запроса.</param>
        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.ContentLength.HasValue && context.Request.ContentLength > _maxBodySizeBytes)
            {
                context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                context.Response.ContentType = "application/json";
                var errorResponse = new { success = false, message = "Превышен максимальный размер тела запроса." };
                await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
                return;
            }

            await _next(context);
        }
    }
}