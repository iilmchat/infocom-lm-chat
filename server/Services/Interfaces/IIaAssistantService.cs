using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для операций ИИ-ассистентов с файловой системой и Git.
    /// </summary>
    public interface IIaAssistantService
    {
        /// <summary>
        /// Запускает предопределённый .bat-скрипт для создания структуры проекта.
        /// </summary>        
        Task<RunBatResponse> RunBatAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Сохраняет файл в проекте по относительному пути.
        /// </summary>        
        Task<SaveCodeResponse> SaveCodeAsync(int projectId, int currentUserId, bool isAdmin, string path, string content, CancellationToken cancellationToken = default);

        /// <summary>
        /// Выполняет git add и git commit в репозитории проекта.
        /// </summary>        
        Task<CommitResponse> CommitAsync(int projectId, int currentUserId, bool isAdmin, string message, CancellationToken cancellationToken = default);
    }
}