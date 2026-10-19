using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для управления настройками LM Studio.
    /// </summary>
    public interface ILmStudioSettingsService
    {
        /// <summary>
        /// Получить текущие настройки.
        /// </summary>
        Task<LmStudioSettingsDto> GetSettingsAsync();

        /// <summary>
        /// Обновить настройки (только для администратора).
        /// </summary>
        Task<LmStudioSettingsDto> UpdateSettingsAsync(UpdateLmStudioSettingsRequest request, int currentUserId);
    }
}