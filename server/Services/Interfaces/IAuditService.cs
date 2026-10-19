using System.Threading.Tasks;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для логирования действий пользователей (добавлен в версии 1.2)
    /// </summary>
    public interface IAuditService
    {
        Task LogAsync(int userId, string action, string entityType, int? entityId = null, object details = null);
    }
}