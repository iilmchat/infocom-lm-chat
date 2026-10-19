using System;

namespace ProjectManager.API.Exceptions
{
    /// <summary>
    /// Исключение, возникающее при недоступности сервера LM Studio.
    /// </summary>
    public class LmStudioUnavailableException : Exception
    {
        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioUnavailableException"/>.
        /// </summary>
        /// <param name="message">Сообщение об ошибке.</param>
        public LmStudioUnavailableException(string message) : base(message) { }

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioUnavailableException"/> с внутренним исключением.
        /// </summary>
        /// <param name="message">Сообщение об ошибке.</param>
        /// <param name="innerException">Внутреннее исключение.</param>
        public LmStudioUnavailableException(string message, Exception innerException) : base(message, innerException) { }
    }
}