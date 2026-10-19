using System;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Помощник для генерации уникальных токенов сессий
    /// </summary>
    public static class TokenHelper
    {
        /// <summary>
        /// Генерирует новый токен в виде случайного GUID
        /// </summary>
        public static string GenerateToken()
        {
            return Guid.NewGuid().ToString("N");
        }
    }
}