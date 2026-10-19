using System;
using System.Security.Cryptography;
using System.Text;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Вспомогательный класс для хэширования паролей (SHA256)
    /// </summary>
    public static class PasswordHelper
    {
        /// <summary>
        /// Вычисляет SHA256 хэш от строки пароля
        /// </summary>
        public static string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(password);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }

        /// <summary>
        /// Проверяет, соответствует ли пароль хэшу
        /// </summary>
        public static bool VerifyPassword(string password, string hash)
        {
            var computedHash = HashPassword(password);
            return computedHash == hash;
        }
    }
}