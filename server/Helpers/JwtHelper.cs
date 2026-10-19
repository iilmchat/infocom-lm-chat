using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using ProjectManager.API.Models;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Помощник для работы с JWT-токенами
    /// </summary>
    public class JwtHelper
    {
        private readonly IConfiguration _configuration;

        public JwtHelper(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        /// <summary>
        /// Генерирует JWT-токен для пользователя
        /// </summary>
        public string GenerateToken(User user, out DateTime expiresAt)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = Encoding.UTF8.GetBytes(jwtSettings["Key"]);
            var expiryHours = double.Parse(jwtSettings["ExpiryInHours"]);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);

            expiresAt = DateTime.UtcNow.AddHours(expiryHours);

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: expiresAt,
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        /// <summary>
        /// Извлекает идентификатор пользователя из токена (без проверки валидности)
        /// </summary>
        public int? GetUserIdFromToken(string token)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var jsonToken = handler.ReadJwtToken(token);
                var claim = jsonToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
                if (claim != null && int.TryParse(claim.Value, out int userId))
                    return userId;
                return null;
            }
            catch
            {
                return null;
            }
        }
    }
}