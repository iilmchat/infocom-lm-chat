using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис ИИ-ассистента "Тестировщик".
    /// </summary>
    public interface ITesterService
    {
        /// <summary>
        /// Генерирует тестовые артефакты (ТП, ТК, ОТ) на основе принятых входных документов.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат генерации.</returns>
        Task<TesterGenerationResult> GenerateTestArtifactsAsync(
            int projectId,
            int userId,
            bool isAdmin,
            CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Результат генерации тестировщиком.
    /// </summary>
    public class TesterGenerationResult
    {
        /// <summary>Список созданных документов (если успех).</summary>
        public List<DocumentDto> CreatedDocuments { get; set; } = new List<DocumentDto>();

        /// <summary>Документ ошибки (если ошибка).</summary>
        public DocumentDto ErrorDocument { get; set; }

        /// <summary>Признак успешной генерации.</summary>
        public bool Success => ErrorDocument == null;
    }
}