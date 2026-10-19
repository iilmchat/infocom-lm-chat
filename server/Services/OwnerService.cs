using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    public class OwnerService : IOwnerService
    {
        private readonly AppDbContext _context;

        public OwnerService(AppDbContext context) => _context = context;

        public async Task<List<OwnerDto>> GetOwnersAsync(int projectId, int currentUserId, bool isAdmin)
        {
            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет доступа к списку владельцев этого проекта.");

            var owners = await _context.ProjectOwners
                .Include(o => o.User)
                .Where(o => o.ProjectId == projectId)
                .ToListAsync();

            return owners.Select(o => new OwnerDto
            {
                Id = o.Id,
                UserId = o.UserId,
                Username = o.User?.Username,
                AssignedAt = o.AssignedAt
            }).ToList();
        }

        public async Task<OwnerDto> AddOwnerAsync(int projectId, int currentUserId, bool isAdmin, int newOwnerId)
        {
            // Проверяем права (если не админ и не владелец)
            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на добавление владельцев.");

            // Проверяем существование проекта
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null)
                throw new KeyNotFoundException("Проект не найден.");

            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять владельцев закрытого проекта.");

            // Проверяем, существует ли пользователь
            var user = await _context.Users.FindAsync(newOwnerId);
            if (user == null)
                throw new KeyNotFoundException("Пользователь не найден.");

            // Проверяем, не является ли уже владельцем
            var existing = await _context.ProjectOwners.FirstOrDefaultAsync(o => o.ProjectId == projectId && o.UserId == newOwnerId);
            if (existing != null)
                throw new InvalidOperationException("Этот пользователь уже является владельцем проекта.");

            var owner = new ProjectOwner
            {
                ProjectId = projectId,
                UserId = newOwnerId,
                AssignedAt = DateTime.UtcNow
            };

            _context.ProjectOwners.Add(owner);
            await _context.SaveChangesAsync();

            return new OwnerDto
            {
                Id = owner.Id,
                UserId = owner.UserId,
                Username = user.Username,
                AssignedAt = owner.AssignedAt
            };
        }

        public async Task RemoveOwnerAsync(int projectId, int currentUserId, bool isAdmin, int ownerId)
        {
            if (!isAdmin && !await IsProjectOwnerAsync(projectId, currentUserId))
                throw new UnauthorizedAccessException("У вас нет прав на удаление владельцев.");

            var owner = await _context.ProjectOwners
                .Include(o => o.Project)
                .FirstOrDefaultAsync(o => o.Id == ownerId && o.ProjectId == projectId);

            if (owner == null)
                throw new KeyNotFoundException("Запись владельца не найдена.");

            if (owner.Project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять владельцев закрытого проекта.");

            // Проверяем, что это не последний владелец
            var count = await _context.ProjectOwners.CountAsync(o => o.ProjectId == projectId);
            if (count <= 1)
                throw new InvalidOperationException("Нельзя удалить последнего владельца проекта.");

            _context.ProjectOwners.Remove(owner);
            await _context.SaveChangesAsync();
        }

        private async Task<bool> IsProjectOwnerAsync(int projectId, int userId)
        {
            return await _context.ProjectOwners.AnyAsync(o => o.ProjectId == projectId && o.UserId == userId);
        }
    }
}