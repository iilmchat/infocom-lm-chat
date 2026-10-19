using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис ИИ-ассистента "Аналитик".
    /// </summary>
    public interface IAnalystService
    {
        /// <summary>
        /// Генерирует технические требования (ТТ) на основе принятого ИД.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат генерации.</returns>
        Task<AnalystGenerationResult> GenerateTechnicalRequirementsAsync(
            int projectId,
            int userId,
            bool isAdmin,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Генерирует аналитические артефакты (АТ, РИСК, ПИ) на основе принятого ТТ.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат генерации.</returns>
        Task<AnalystGenerationResult> GenerateAnalysisAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);            
    }

    /// <summary>
    /// Результат генерации аналитиком.
    /// </summary>
    public class AnalystGenerationResult
    {
        /// <summary>Созданный документ ТТ (если успех).</summary>
        public DocumentDto CreatedDocument { get; set; }

        /// <summary>Документ ошибки (если ошибка).</summary>
        public DocumentDto ErrorDocument { get; set; }

        /// <summary>Признак успешной генерации.</summary>
        public bool Success => ErrorDocument == null;

        /// <summary>Список созданных документов (если успех).</summary>
        public List<DocumentDto> CreatedDocuments { get; set; } = new List<DocumentDto>();        
    }
}