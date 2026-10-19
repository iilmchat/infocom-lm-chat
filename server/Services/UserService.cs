using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса для работы с пользователями.
    /// </summary>
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;

        /// <summary>
        /// Инициализирует новый экземпляр <see cref="UserService"/>.
        /// </summary>
        /// <param name="context">Контекст базы данных.</param>
        public UserService(AppDbContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<User> GetUserByIdAsync(int userId)
        {
            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);
        }
    }
}