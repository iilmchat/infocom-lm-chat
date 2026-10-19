using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Models;

namespace ProjectManager.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Session> Sessions { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectOwner> ProjectOwners { get; set; }
        public DbSet<Document> Documents { get; set; }

        // Добавлено в версии 1.2
        public DbSet<AuditLog> AuditLogs { get; set; }

        // Добавлено в версии 2.2
        // Новые сущности
        public DbSet<LmStudioSettings> LmStudioSettings { get; set; }
        public DbSet<AssistantPrompt> AssistantPrompts { get; set; }

        // Добавлено в версии 2.3
        // Новые сущности
        public DbSet<DeveloperTask> DeveloperTasks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Уникальность имени пользователя
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            // Связь User -> Sessions (один ко многим)
            modelBuilder.Entity<Session>()
                .HasOne(s => s.User)
                .WithMany(u => u.Sessions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Индекс для быстрого поиска по токену
            modelBuilder.Entity<Session>()
                .HasIndex(s => s.Token)
                .IsUnique();

            // Project
            modelBuilder.Entity<Project>()
                .HasOne(p => p.Creator)
                .WithMany()
                .HasForeignKey(p => p.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // ProjectOwner
            modelBuilder.Entity<ProjectOwner>()
                .HasOne(po => po.Project)
                .WithMany(p => p.Owners)
                .HasForeignKey(po => po.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ProjectOwner>()
                .HasOne(po => po.User)
                .WithMany()
                .HasForeignKey(po => po.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ProjectOwner>()
                .HasIndex(po => new { po.ProjectId, po.UserId })
                .IsUnique();

            // Document
            modelBuilder.Entity<Document>()
                .HasOne(d => d.Project)
                .WithMany(p => p.Documents)
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<Document>()
                .HasOne(d => d.Creator)
                .WithMany()
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Document>()
                .HasOne(d => d.Acceptor)
                .WithMany()
                .HasForeignKey(d => d.AcceptedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // Уникальный фильтрованный индекс для одной активной версии на тип в проекте
            modelBuilder.Entity<Document>()
                .HasIndex(d => new { d.ProjectId, d.Type })
                .HasFilter("IsActive = 1")
                .IsUnique();

            // Добавлено в версии 1.2: составные индексы для улучшения производительности
            modelBuilder.Entity<Document>()
                .HasIndex(d => new { d.ProjectId, d.IsActive, d.IsAccepted })
                .HasName("IX_Documents_Project_Active_Accepted");

            modelBuilder.Entity<Document>()
                .HasIndex(d => new { d.ProjectId, d.Type })
                .HasName("IX_Documents_Project_Type");

            // AuditLog
            modelBuilder.Entity<AuditLog>()
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => a.Timestamp)
                .HasName("IX_AuditLog_Timestamp");

            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => new { a.EntityType, a.EntityId })
                .HasName("IX_AuditLog_Entity");

            // Новые настройки
            modelBuilder.Entity<LmStudioSettings>()
                .HasOne(ls => ls.Updater)
                .WithMany()
                .HasForeignKey(ls => ls.UpdatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AssistantPrompt>()
                .HasIndex(ap => ap.AssistantType)
                .IsUnique();

            modelBuilder.Entity<AssistantPrompt>()
                .HasOne(ap => ap.Updater)
                .WithMany()
                .HasForeignKey(ap => ap.UpdatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // DeveloperTask
            modelBuilder.Entity<DeveloperTask>()
                .HasOne(dt => dt.Project)
                .WithMany()
                .HasForeignKey(dt => dt.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<DeveloperTask>()
                .HasOne(dt => dt.Creator)
                .WithMany()
                .HasForeignKey(dt => dt.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<DeveloperTask>()
                .HasIndex(dt => new { dt.ProjectId, dt.Order })
                .HasName("IX_DeveloperTasks_Project_Order");                
                    
        }
    }
}