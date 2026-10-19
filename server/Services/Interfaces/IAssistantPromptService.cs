using System.Collections.Generic;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для управления системными промтами ассистентов.
    /// </summary>
    public interface IAssistantPromptService
    {
        /// <summary>
        /// Получить промт для указанного типа ассистента.
        /// </summary>
        Task<AssistantPromptDto> GetPromptAsync(string assistantType);

        /// <summary>
        /// Получить все промты.
        /// </summary>
        Task<List<AssistantPromptDto>> GetAllPromptsAsync();

        /// <summary>
        /// Обновить промт для указанного типа ассистента.
        /// </summary>
        Task<AssistantPromptDto> UpdatePromptAsync(string assistantType, UpdateAssistantPromptRequest request, int currentUserId);

        //Task<AssistantPromptDto> GetPromptAsync(string assistantType);
    }
}