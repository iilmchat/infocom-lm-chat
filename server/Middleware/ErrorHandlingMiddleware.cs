using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;

namespace ProjectManager.API.Middleware
{
    /// <summary>
    /// Глобальный middleware для перехвата и обработки исключений
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
                _logger.LogError(ex, "Произошла необработанная ошибка");
                await HandleExceptionAsync(context, ex);
            }
        }

        private static Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            context.Response.ContentType = "application/json";

            // Определяем статус-код в зависимости от типа исключения
            //int statusCode;
            /*
            switch (exception)
            {
                case UnauthorizedAccessException:
                    statusCode = (int) HttpStatusCode.Unauthorized;
                    break;
                case InvalidOperationException:
                case ArgumentException:
                    statusCode = (int) HttpStatusCode.BadRequest;
                    break;
                case KeyNotFoundException:
                    statusCode = (int) HttpStatusCode.NotFound;
                    break;
                default:
                    statusCode = (int) HttpStatusCode.InternalServerError;
                    break;
            }
            */
            int statusCode;
            //Проверить
            if (exception is UnauthorizedAccessException)
            {
                statusCode = (int)HttpStatusCode.Unauthorized;
            }
            else if (exception is InvalidOperationException || exception is ArgumentException)
            {
                statusCode = (int)HttpStatusCode.BadRequest;
            }
            else if (exception is KeyNotFoundException)
            {
                statusCode = (int) HttpStatusCode.NotFound;
            }
            else
            {
                statusCode = (int) HttpStatusCode.InternalServerError;
            }


            context.Response.StatusCode = statusCode;

            var result = JsonSerializer.Serialize(new
            {
                success = false,
                statusCode = statusCode,
                message = exception.Message,
                // в разработке можно добавить stackTrace, но в продакшене лучше убрать
                // details = exception.StackTrace
            });

            return context.Response.WriteAsync(result);
        }
    }
}