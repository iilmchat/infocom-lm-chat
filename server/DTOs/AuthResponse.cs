namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Ответ при успешной аутентификации
    /// </summary>
    public class AuthResponse
    {
        public int UserId { get; set; }
        public string Username { get; set; }
        public string Role { get; set; }
        public string Token { get; set; }
        public long ExpiresIn { get; set; } // секунды до истечения
    }
}