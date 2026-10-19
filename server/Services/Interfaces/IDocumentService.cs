using System.Collections.Generic;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис управления документами проекта
    /// </summary>
    public interface IDocumentService
    {
        /// <summary>Получить все версии всех документов проекта</summary>
        Task<List<DocumentDto>> GetDocumentsAsync(int projectId, int currentUserId, bool isAdmin);

        /// <summary>Получить активные версии документов (по одной на тип)</summary>
        Task<List<DocumentDto>> GetActiveDocumentsAsync(int projectId, int currentUserId, bool isAdmin);

        /// <summary>Получить все версии документа указанного типа</summary>
        Task<List<DocumentDto>> GetDocumentVersionsAsync(int projectId, string type, int currentUserId, bool isAdmin);

        /// <summary>Получить конкретную версию документа по ID</summary>
        Task<DocumentDto> GetDocumentByIdAsync(int documentId, int projectId, int currentUserId, bool isAdmin);

        /// <summary>Создать новую версию документа (черновик)</summary>
        Task<DocumentDto> CreateDocumentAsync(int projectId, int currentUserId, bool isAdmin, string type, string title, string content);

        /// <summary>Обновить черновик документа (только если не принят)</summary>
        Task<DocumentDto> UpdateDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin, string title, string content);

        /// <summary>Принять версию документа (становится активной)</summary>
Task<DocumentDto> AcceptDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>Удалить черновик документа (только если не принят)</summary>
        Task DeleteDocumentAsync(int documentId, int projectId, int currentUserId, bool isAdmin);

        // Добавлено в версии 1.2
        Task<PagedResult<DocumentDto>> GetDocumentsPagedAsync(int projectId, int currentUserId, bool isAdmin, int page, int pageSize, string type = null);
        Task<List<DocumentDto>> SearchDocumentsAsync(int projectId, int currentUserId, bool isAdmin, string query);
    }
}