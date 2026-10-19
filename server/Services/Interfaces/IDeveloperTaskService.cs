using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ProjectManager.API.DTOs;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис управления задачами разработчика (декомпозиция и жизненный цикл задач).
    /// </summary>
    public interface IDeveloperTaskService
    {
        /// <summary>
        /// Генерирует план задач разработчика на основе принятых архитектурных артефактов.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список созданных задач.</returns>
        Task<List<DeveloperTaskDto>> GeneratePlanAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Получает список задач проекта.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список задач.</returns>
        Task<List<DeveloperTaskDto>> GetTasksAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Обновляет задачу разработчика (ручная корректировка владельцем).
        /// </summary>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="request">Данные для обновления.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        Task<DeveloperTaskDto> UpdateTaskAsync(int taskId, int projectId, int userId, bool isAdmin, UpdateDeveloperTaskRequest request, CancellationToken cancellationToken = default);

        /// <summary>
        /// Утверждает план задач (все задачи переходят в статус Pending).
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Список утверждённых задач.</returns>
        Task<List<DeveloperTaskDto>> ApprovePlanAsync(int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Выполняет конкретную задачу разработчика (запускает LM Studio для генерации артефактов).
        /// </summary>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        Task<DeveloperTaskDto> RunTaskAsync(int taskId, int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Подтверждает результат выполнения задачи (владелец).
        /// </summary>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        Task<DeveloperTaskDto> ApproveTaskAsync(int taskId, int projectId, int userId, bool isAdmin, CancellationToken cancellationToken = default);

        /// <summary>
        /// Отклоняет результат выполнения задачи с комментарием (владелец).
        /// </summary>
        /// <param name="taskId">Идентификатор задачи.</param>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="userId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="comment">Комментарий с ошибками и недочётами.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Обновлённая задача.</returns>
        Task<DeveloperTaskDto> RejectTaskAsync(int taskId, int projectId, int userId, bool isAdmin, string comment, CancellationToken cancellationToken = default);
    }
}