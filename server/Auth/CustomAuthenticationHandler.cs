using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Auth
{
    /// <summary>
    /// Обработчик аутентификации на основе токена сессии (Bearer).
    /// </summary>
    public class CustomAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        private readonly ISessionService _sessionService;
        private readonly IUserService _userService;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="CustomAuthenticationHandler"/>.
        /// </summary>
        /// <param name="options">Настройки схемы аутентификации.</param>
        /// <param name="logger">Логгер.</param>
        /// <param name="encoder">Кодировщик URL.</param>
        /// <param name="clock">Системные часы.</param>
        /// <param name="sessionService">Сервис сессий.</param>
        /// <param name="userService">Сервис пользователей.</param>
        public CustomAuthenticationHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            ISystemClock clock,
            ISessionService sessionService,
            IUserService userService)
            : base(options, logger, encoder, clock)
        {
            _sessionService = sessionService;
            _userService = userService;
        }

        /// <summary>
        /// Выполняет аутентификацию запроса.
        /// </summary>
        /// <returns>Результат аутентификации.</returns>
        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // Проверяем наличие заголовка Authorization
            if (!Request.Headers.TryGetValue("Authorization", out var authHeader))
                return AuthenticateResult.NoResult();

            var authHeaderValue = authHeader.ToString();
            if (!authHeaderValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                return AuthenticateResult.NoResult();

            var token = authHeaderValue.Substring("Bearer ".Length).Trim();
            if (string.IsNullOrEmpty(token))
                return AuthenticateResult.NoResult();

            // Проверяем токен через сервис сессий
            var userId = await _sessionService.GetUserIdByTokenAsync(token);
            if (!userId.HasValue)
                return AuthenticateResult.Fail("Токен недействителен или истёк.");

            // Получаем пользователя для установки claims (включая роль)
            var user = await _userService.GetUserByIdAsync(userId.Value);
            if (user == null)
                return AuthenticateResult.Fail("Пользователь не найден.");

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);

            return AuthenticateResult.Success(ticket);
        }
    }
}