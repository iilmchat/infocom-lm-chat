using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для работы ИИ-ассистента "Архитектор".
    /// </summary>
    public interface IArchitectService
    {
        /// <summary>
        /// Выполняет генерацию четырёх артефактов архитектором на основе документов ИД и ТТ.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <returns>Результат генерации (информация о созданных документах).</returns>
        Task<ArchitectGenerationResult> GenerateAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Результат генерации архитектором.
    /// </summary>
    public class ArchitectGenerationResult
    {
        /// <summary>Список созданных документов (ИТ, СП, СФС, ЭР).</summary>
        public List<DocumentDto> CreatedDocuments { get; set; }

        /// <summary>Документ с ошибкой, если генерация не удалась (тип ERR_*).</summary>
        public DocumentDto ErrorDocument { get; set; }

        /// <summary>Флаг успешной генерации.</summary>
        public bool Success => ErrorDocument == null;
    }
}