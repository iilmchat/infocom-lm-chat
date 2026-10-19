using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Запись аудита действий пользователей
    /// </summary>
    public class AuditLog
    {
        public int Id { get; set; }

        /// <summary>Идентификатор пользователя, выполнившего действие</summary>
        public int UserId { get; set; }
        public User User { get; set; }

        /// <summary>Тип действия (CreateProject, CopyProject, UpdateDocument, ...)</summary>
        public string Action { get; set; }

        /// <summary>Тип сущности (Project, Document, Owner, ...)</summary>
        public string EntityType { get; set; }

        /// <summary>Идентификатор сущности (или null, если не применимо)</summary>
        public int? EntityId { get; set; }

        /// <summary>Дополнительные данные в формате JSON</summary>
        public string Details { get; set; }

        /// <summary>Время совершения действия</summary>
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}