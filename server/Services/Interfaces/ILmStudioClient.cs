using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Клиент для взаимодействия с LM Studio (OpenAI-совместимый API).
    /// </summary>
    public interface ILmStudioClient
    {
        /// <summary>
        /// Проверяет доступность сервера LM Studio.
        /// </summary>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>True, если сервер доступен.</returns>
        Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Получает список доступных моделей.
        /// </summary>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список моделей.</returns>
        Task<List<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Отправляет запрос на завершение чата с поддержкой tool calling.
        /// </summary>
        /// <param name="systemPrompt">Системный промт.</param>
        /// <param name="userMessage">Сообщение пользователя.</param>
        /// <param name="tools">Список определений инструментов.</param>
        /// <param name="model">Имя модели (если null, используется модель по умолчанию).</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Структурированный ответ модели.</returns>
        Task<LmStudioResponse> SendChatCompletionAsync(
            string systemPrompt,
            string userMessage,
            List<ToolDefinition> tools,
            string model = null,
            CancellationToken cancellationToken = default);
    }
}