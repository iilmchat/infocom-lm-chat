using System;

namespace ProjectManager.API.Exceptions
{
    /// <summary>
    /// Исключение, возникающее когда запрошенная модель не найдена на сервере LM Studio.
    /// </summary>
    public class LmStudioModelNotFoundException : Exception
    {
        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioModelNotFoundException"/>.
        /// </summary>
        /// <param name="message">Сообщение об ошибке.</param>
        public LmStudioModelNotFoundException(string message) : base(message) { }

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="LmStudioModelNotFoundException"/> с внутренним исключением.
        /// </summary>
        /// <param name="message">Сообщение об ошибке.</param>
        /// <param name="innerException">Внутреннее исключение.</param>
        public LmStudioModelNotFoundException(string message, Exception innerException) : base(message, innerException) { }
    }
}