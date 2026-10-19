using System;
using System.Text.Json;
using System.Threading.Tasks;
using ProjectManager.API.Data;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса аудита (добавлен в версии 1.2)
    /// </summary>
    public class AuditService : IAuditService
    {
        private readonly AppDbContext _context;

        public AuditService(AppDbContext context)
        {
            _context = context;
        }

        public async Task LogAsync(int userId, string action, string entityType, int? entityId = null, object details = null)
        {
            var log = new AuditLog
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Details = details != null ? JsonSerializer.Serialize(details) : null,
                Timestamp = DateTime.UtcNow
            };
            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync();
        }
    }
}