// Database/ChatDbContext.cs
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Database
{
    /// <summary>
    /// Контекст базы данных для чата с поддержкой всех сущностей
    /// </summary>
    public class ChatDbContext : DbContext
    {
        public ChatDbContext(DbContextOptions<ChatDbContext> options) : base(options)
        {
        }

        // === ОСНОВНЫЕ СУЩНОСТИ ===
        public DbSet<User> Users { get; set; }
        public DbSet<Room> Rooms { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<PrivateChat> PrivateChats { get; set; }
        public DbSet<PrivateMessage> PrivateMessages { get; set; }
        public DbSet<UserRoom> UserRooms { get; set; }
        public DbSet<BlockedUser> BlockedUsers { get; set; }
        public DbSet<ModerationLog> ModerationLogs { get; set; }
        public DbSet<SystemSetting> SystemSettings { get; set; }

        // === НОВЫЕ СУЩНОСТИ ===
        public DbSet<MessageReaction> MessageReactions { get; set; }
        public DbSet<Attachment> Attachments { get; set; }
        public DbSet<Mention> Mentions { get; set; }

        // === для новых сущностей (индексы, отношения) ===
        public DbSet<PinnedMessage> PinnedMessages { get; set; }
        public DbSet<Report> Reports { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<BotAccount> BotAccounts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // === УНИКАЛЬНЫЕ ИНДЕКСЫ ===

            // Пользователи
            modelBuilder.Entity<User>()
                .HasIndex(u => u.UserId)
                .IsUnique();

            // Комнаты
            modelBuilder.Entity<Room>()
                .HasIndex(r => r.RoomId)
                .IsUnique();

            // Приватные чаты
            modelBuilder.Entity<PrivateChat>()
                .HasIndex(pc => pc.ChatId)
                .IsUnique();

            // Сообщения
            modelBuilder.Entity<Message>()
                .HasIndex(m => m.MessageId)
                .IsUnique();

            // Приватные сообщения
            modelBuilder.Entity<PrivateMessage>()
                .HasIndex(pm => pm.MessageId)
                .IsUnique();

            // Логи модерации
            modelBuilder.Entity<ModerationLog>()
                .HasIndex(ml => ml.LogId)
                .IsUnique();

            // Системные настройки
            modelBuilder.Entity<SystemSetting>()
                .HasIndex(ss => ss.Key)
                .IsUnique();

            // === ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ ===

            // Индексы для Messages
            modelBuilder.Entity<Message>()
                .HasIndex(m => new { m.RoomId, m.Timestamp })
                .HasName("IX_Messages_RoomId_Timestamp");

            modelBuilder.Entity<Message>()
                .HasIndex(m => new { m.UserId, m.Timestamp })
                .HasName("IX_Messages_UserId_Timestamp");

            // Индексы для UserRooms
            modelBuilder.Entity<UserRoom>()
                .HasIndex(ur => new { ur.UserId, ur.RoomId })
                .IsUnique()
                .HasName("IX_UserRooms_UserId_RoomId")
                .HasFilter("[IsActive] = 1");

            modelBuilder.Entity<UserRoom>()
                .HasIndex(ur => new { ur.RoomId, ur.IsActive })
                .HasName("IX_UserRooms_RoomId_IsActive");

            // Индексы для PrivateMessages
            modelBuilder.Entity<PrivateMessage>()
                .HasIndex(pm => new { pm.ChatId, pm.Timestamp })
                .HasName("IX_PrivateMessages_ChatId_Timestamp");

            modelBuilder.Entity<PrivateMessage>()
                .HasIndex(pm => new { pm.ReceiverId, pm.IsRead })
                .HasName("IX_PrivateMessages_ReceiverId_IsRead");

            // Индексы для Rooms
            modelBuilder.Entity<Room>()
                .HasIndex(r => new { r.RoomType, r.IsActive })
                .HasName("IX_Rooms_RoomType_IsActive");

            modelBuilder.Entity<Room>()
                .HasIndex(r => r.LastActivity)
                .HasName("IX_Rooms_LastActivity");

            // Индексы для Users
            modelBuilder.Entity<User>()
                .HasIndex(u => new { u.Role, u.IsOnline })
                .HasName("IX_Users_Role_IsOnline");
                //.HasDatabaseName("IX_Users_Role_IsOnline");


            modelBuilder.Entity<User>()
                .HasIndex(u => u.LastSeen)
                .HasName("IX_Users_LastSeen");

            // Индексы для новых сущностей
            modelBuilder.Entity<MessageReaction>()
                .HasIndex(mr => new { mr.MessageId, mr.UserId, mr.Reaction })
                .IsUnique()
                .HasName("IX_MessageReactions_MessageId_UserId_Reaction");

            modelBuilder.Entity<MessageReaction>()
                .HasIndex(mr => mr.MessageId)
                .HasName("IX_MessageReactions_MessageId");

            modelBuilder.Entity<Mention>()
                .HasIndex(m => new { m.UserId, m.IsRead })
                .HasName("IX_Mentions_UserId_IsRead");

            modelBuilder.Entity<Mention>()
                .HasIndex(m => m.MessageId)
                .HasName("IX_Mentions_MessageId");

            modelBuilder.Entity<Attachment>()
                .HasIndex(a => a.MessageId)
                .HasName("IX_Attachments_MessageId");

            // === ОТНОШЕНИЯ ===

            // Сообщения -> Пользователи
            modelBuilder.Entity<Message>()
                .HasOne(m => m.User)
                .WithMany(u => u.Messages)
                .HasForeignKey(m => m.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Сообщения -> Комнаты
            modelBuilder.Entity<Message>()
                .HasOne(m => m.Room)
                .WithMany(r => r.Messages)
                .HasForeignKey(m => m.RoomId)
                .HasPrincipalKey(r => r.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            // Пользователи -> Комнаты (связь многие-ко-многим)
            modelBuilder.Entity<UserRoom>()
                .HasOne(ur => ur.User)
                .WithMany(u => u.UserRooms)
                .HasForeignKey(ur => ur.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserRoom>()
                .HasOne(ur => ur.Room)
                .WithMany(r => r.UserRooms)
                .HasForeignKey(ur => ur.RoomId)
                .HasPrincipalKey(r => r.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            // Приватные чаты
            modelBuilder.Entity<PrivateChat>()
                .HasOne(pc => pc.User1)
                .WithMany(u => u.PrivateChats1)
                .HasForeignKey(pc => pc.User1Id)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateChat>()
                .HasOne(pc => pc.User2)
                .WithMany(u => u.PrivateChats2)
                .HasForeignKey(pc => pc.User2Id)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Приватные сообщения
            modelBuilder.Entity<PrivateMessage>()
                .HasOne(pm => pm.Chat)
                .WithMany(pc => pc.PrivateMessages)
                .HasForeignKey(pm => pm.ChatId)
                .HasPrincipalKey(pc => pc.ChatId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PrivateMessage>()
                .HasOne(pm => pm.Sender)
                .WithMany()
                .HasForeignKey(pm => pm.SenderId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessage>()
                .HasOne(pm => pm.Receiver)
                .WithMany()
                .HasForeignKey(pm => pm.ReceiverId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Блокировки
            modelBuilder.Entity<BlockedUser>()
                .HasOne(bu => bu.User)
                .WithMany(u => u.BlockedUsers)
                .HasForeignKey(bu => bu.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            modelBuilder.Entity<BlockedUser>()
                .HasOne(bu => bu.Blocked)
                .WithMany(u => u.BlockedBy)
                .HasForeignKey(bu => bu.BlockedUserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.NoAction);

            // Логи модерации
            modelBuilder.Entity<ModerationLog>()
                .HasOne(ml => ml.Moderator)
                .WithMany(u => u.ModerationLogs)
                .HasForeignKey(ml => ml.ModeratorId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<ModerationLog>()
                .HasOne(ml => ml.TargetUser)
                .WithMany()
                .HasForeignKey(ml => ml.TargetUserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // === ОТНОШЕНИЯ ДЛЯ НОВЫХ СУЩНОСТЕЙ ===

            // Реакции на сообщения
            modelBuilder.Entity<MessageReaction>()
                .HasOne(mr => mr.Message)
                .WithMany()
                .HasForeignKey(mr => mr.MessageId)
                .HasPrincipalKey(m => m.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MessageReaction>()
                .HasOne(mr => mr.User)
                .WithMany()
                .HasForeignKey(mr => mr.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Вложения
            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Message)
                .WithMany()
                .HasForeignKey(a => a.MessageId)
                .HasPrincipalKey(m => m.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            // Упоминания
            modelBuilder.Entity<Mention>()
                .HasOne(m => m.Message)
                .WithMany()
                .HasForeignKey(m => m.MessageId)
                .HasPrincipalKey(m => m.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Mention>()
                .HasOne(m => m.User)
                .WithMany()
                .HasForeignKey(m => m.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Mention>()
                .HasOne(m => m.MentionedByUser)
                .WithMany()
                .HasForeignKey(m => m.MentionedBy)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // PinnedMessages
            modelBuilder.Entity<PinnedMessage>()
                .HasIndex(p => new { p.RoomId, p.MessageId })
                .IsUnique()
                .HasName("IX_PinnedMessages_RoomId_MessageId");

            modelBuilder.Entity<PinnedMessage>()
                .HasOne(p => p.Message)
                .WithMany()
                .HasForeignKey(p => p.MessageId)
                .HasPrincipalKey(m => m.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<PinnedMessage>()
                .HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.PinnedBy)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Reports
            modelBuilder.Entity<Report>()
                .HasIndex(r => r.MessageId)
                .HasName("IX_Reports_MessageId");

            modelBuilder.Entity<Report>()
                .HasIndex(r => r.IsResolved)
                .HasName("IX_Reports_IsResolved");

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Message)
                .WithMany()
                .HasForeignKey(r => r.MessageId)
                .HasPrincipalKey(m => m.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Reporter)
                .WithMany()
                .HasForeignKey(r => r.ReporterId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Report>()
                .HasOne(r => r.Resolver)
                .WithMany()
                .HasForeignKey(r => r.ResolvedBy)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Notifications
            modelBuilder.Entity<Notification>()
                .HasIndex(n => new { n.UserId, n.IsRead })
                .HasName("IX_Notifications_UserId_IsRead");

            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // UserSessions
            modelBuilder.Entity<UserSession>()
                .HasIndex(s => s.SessionId)
                .IsUnique()
                .HasName("IX_UserSessions_SessionId");

            modelBuilder.Entity<UserSession>()
                .HasIndex(s => new { s.UserId, s.IsActive })
                .HasName("IX_UserSessions_UserId_IsActive");

            modelBuilder.Entity<UserSession>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // BotAccounts
            modelBuilder.Entity<BotAccount>()
                .HasIndex(b => b.ApiKey)
                .IsUnique()
                .HasName("IX_BotAccounts_ApiKey");

            modelBuilder.Entity<BotAccount>()
                .HasOne(b => b.Owner)
                .WithMany()
                .HasForeignKey(b => b.OwnerId)
                .HasPrincipalKey(u => u.UserId)
                .OnDelete(DeleteBehavior.Restrict);

        }
    }
}