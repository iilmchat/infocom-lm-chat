using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using ProjectManager.API.Helpers;

namespace ProjectManager.API.Middleware
{
    /// <summary>
    /// Middleware для добавления заголовка X-App-Version ко всем ответам.
    /// </summary>
    public class VersionHeaderMiddleware
    {
        private readonly RequestDelegate _next;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="VersionHeaderMiddleware"/>.
        /// </summary>
        /// <param name="next">Следующий делегат в конвейере.</param>
        public VersionHeaderMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        /// <summary>
        /// Добавляет заголовок версии и передаёт запрос дальше.
        /// </summary>
        /// <param name="context">HttpContext текущего запроса.</param>
        public async Task InvokeAsync(HttpContext context)
        {
            context.Response.OnStarting(() =>
            {
                context.Response.Headers["X-App-Version"] = AppVersion.Current;
                return Task.CompletedTask;
            });

            await _next(context);
        }
    }
}