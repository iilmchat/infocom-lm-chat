using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Helpers;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    public class AuthService : IAuthService
    {
        private readonly AppDbContext _context;
        private readonly ISessionService _sessionService;

        public AuthService(AppDbContext context, ISessionService sessionService)
        {
            _context = context;
            _sessionService = sessionService;
        }

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
        {
            var existing = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (existing != null)
                throw new InvalidOperationException("Пользователь с таким именем уже существует.");

            var user = new User
            {
                Username = request.Username,
                PasswordHash = PasswordHelper.HashPassword(request.Password),
                Role = "User"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return await LoginInternalAsync(user);
        }

        public async Task<AuthResponse> LoginAsync(LoginRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (user == null || !PasswordHelper.VerifyPassword(request.Password, user.PasswordHash))
                throw new UnauthorizedAccessException("Неверное имя пользователя или пароль.");

            return await LoginInternalAsync(user);
        }

        private async Task<AuthResponse> LoginInternalAsync(User user)
        {
            // Генерируем токен (GUID) и сохраняем сессию
            var token = TokenHelper.GenerateToken();
            var expiresAt = DateTime.UtcNow.AddHours(24); // срок действия 24 часа
            await _sessionService.SaveSessionAsync(user.Id, token, expiresAt);

            return new AuthResponse
            {
                UserId = user.Id,
                Username = user.Username,
                Role = user.Role,
                Token = token,
                ExpiresIn = (long)(expiresAt - DateTime.UtcNow).TotalSeconds
            };
        }
    }
}