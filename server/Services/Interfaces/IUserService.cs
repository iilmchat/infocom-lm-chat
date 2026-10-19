using System.Threading.Tasks;
using ProjectManager.API.Models;

namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Сервис для работы с пользователями.
    /// </summary>
    public interface IUserService
    {
        /// <summary>
        /// Получает пользователя по идентификатору.
        /// </summary>
        /// <param name="userId">Идентификатор пользователя.</param>
        /// <returns>Объект пользователя или null, если не найден.</returns>
        Task<User> GetUserByIdAsync(int userId);
    }
}