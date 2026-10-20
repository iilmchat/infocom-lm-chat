// Models/Entities/User.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Пользователь системы
    /// </summary>
    [Table("Users")]
    public class User
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; } // Внешний идентификатор

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [MaxLength(10)]
        public string Avatar { get; set; }

        [MaxLength(7)]
        public string Color { get; set; }

        [MaxLength(50)]
        public string Email { get; set; }

        [MaxLength(255)]
        public string PasswordHash { get; set; } // Для будущей аутентификации

        [MaxLength(50)]
        public string Role { get; set; } // Admin, User, Guest, Manager

        public bool IsOnline { get; set; }
        public string Status { get; set; } // online, away, busy, offline, banned

        public string BanReason { get; set; }
        public DateTime? BannedAt { get; set; }
        public DateTime? MutedUntil { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime LastSeen { get; set; }
        public DateTime? LastMessageAt { get; set; }

        public int MessageCount { get; set; }
        public int UnreadCount { get; set; }

        public string AvatarType { get; set; }
        public string AvatarData { get; set; }

        // Навигационные свойства
        public virtual ICollection<PrivateChat> PrivateChats1 { get; set; }
        public virtual ICollection<PrivateChat> PrivateChats2 { get; set; }
        public virtual ICollection<Message> Messages { get; set; }
        public virtual ICollection<ModerationLog> ModerationLogs { get; set; }
        public virtual ICollection<UserRoom> UserRooms { get; set; }
        public virtual ICollection<BlockedUser> BlockedUsers { get; set; }
        public virtual ICollection<BlockedUser> BlockedBy { get; set; }

        public User()
        {
            PrivateChats1 = new List<PrivateChat>();
            PrivateChats2 = new List<PrivateChat>();
            Messages = new List<Message>();
            ModerationLogs = new List<ModerationLog>();
            UserRooms = new List<UserRoom>();
            BlockedUsers = new List<BlockedUser>();
            BlockedBy = new List<BlockedUser>();
            CreatedAt = DateTime.UtcNow;
            LastSeen = DateTime.UtcNow;
            Role = "User";
            Status = "offline";
        }
    }

    /// <summary>
    /// Комната (общая или приватная)
    /// </summary>
    [Table("Rooms")]
    public class Room
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string RoomId { get; set; } // Внешний идентификатор

        [MaxLength(200)]
        public string Name { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        public string CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime LastActivity { get; set; }

        public int MessageCount { get; set; }
        public bool IsPrivate { get; set; } // true - приватный чат, false - общая комната
        public bool IsActive { get; set; }

        [MaxLength(50)]
        public string RoomType { get; set; } // "common", "private"

        [MaxLength(255)]
        public string PasswordHash { get; set; }

        [MaxLength(50)]
        public string Model { get; set; }

        // Настройки комнаты (JSON)
        public string SettingsJson { get; set; }
        public string MetadataJson { get; set; }

        // Навигационные свойства
        public virtual ICollection<Message> Messages { get; set; }
        public virtual ICollection<UserRoom> UserRooms { get; set; }

        public Room()
        {
            Messages = new List<Message>();
            UserRooms = new List<UserRoom>();
            CreatedAt = DateTime.UtcNow;
            LastActivity = DateTime.UtcNow;
            IsActive = true;
            RoomType = "common";
            Model = "local-model";
            SettingsJson = "{}";
            MetadataJson = "{}";
        }
    }

    /// <summary>
    /// Сообщение
    /// </summary>
    [Table("Messages")]
    public class Message
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; } // Внешний идентификатор

        [Required]
        [MaxLength(50)]
        public string RoomId { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        [MaxLength(100)]
        public string UserName { get; set; }

        [MaxLength(10)]
        public string UserAvatar { get; set; }

        [MaxLength(20)]
        public string Role { get; set; } // user, assistant, system

        public string Content { get; set; }

        public DateTime Timestamp { get; set; }

        [MaxLength(50)]
        public string ReplyToId { get; set; }

        public bool IsEdited { get; set; }
        public DateTime? EditedAt { get; set; }

        [MaxLength(50)]
        public string Model { get; set; }

        public string AttachmentsJson { get; set; }
        public string MetadataJson { get; set; }

        // Навигационные свойства
        public virtual User User { get; set; }
        public virtual Room Room { get; set; }

        public Message()
        {
            Timestamp = DateTime.UtcNow;
            AttachmentsJson = "[]";
            MetadataJson = "{}";
            Role = "user";
        }
    }

    /// <summary>
    /// Приватный чат
    /// </summary>
    [Table("PrivateChats")]
    public class PrivateChat
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string ChatId { get; set; } // Внешний идентификатор

        [MaxLength(50)]
        public string User1Id { get; set; }

        [MaxLength(50)]
        public string User2Id { get; set; }

        public string LastMessage { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public bool IsActive { get; set; }

        // Навигационные свойства
        public virtual User User1 { get; set; }
        public virtual User User2 { get; set; }
        public virtual ICollection<PrivateMessage> PrivateMessages { get; set; }

        public PrivateChat()
        {
            PrivateMessages = new List<PrivateMessage>();
            CreatedAt = DateTime.UtcNow;
            LastActivity = DateTime.UtcNow;
            IsActive = true;
        }
    }

    /// <summary>
    /// Сообщение в приватном чате
    /// </summary>
    [Table("PrivateMessages")]
    public class PrivateMessage
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string ChatId { get; set; }

        [Required]
        [MaxLength(50)]
        public string SenderId { get; set; }

        [MaxLength(50)]
        public string ReceiverId { get; set; }

        [MaxLength(100)]
        public string SenderName { get; set; }

        [MaxLength(10)]
        public string SenderAvatar { get; set; }
        public string SenderAvatarType { get; set; }
        public string SenderAvatarData { get; set; }

        public string Content { get; set; }

        public DateTime Timestamp { get; set; }
        public bool IsRead { get; set; }
        public DateTime? ReadAt { get; set; }

        [MaxLength(50)]
        public string ReplyToId { get; set; }

        public bool IsEdited { get; set; }
        public DateTime? EditedAt { get; set; }

        public string AttachmentsJson { get; set; }

        // Навигационные свойства
        public virtual PrivateChat Chat { get; set; }
        public virtual User Sender { get; set; }
        public virtual User Receiver { get; set; }

        public PrivateMessage()
        {
            Timestamp = DateTime.UtcNow;
            IsRead = false;
            AttachmentsJson = "[]";
        }
    }

    /// <summary>
    /// Связь пользователя с комнатой
    /// </summary>
    [Table("UserRooms")]
    public class UserRoom
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [MaxLength(50)]
        public string UserId { get; set; }

        [MaxLength(50)]
        public string RoomId { get; set; }

        public DateTime JoinedAt { get; set; }
        public DateTime LastActivity { get; set; }
        public bool IsActive { get; set; }

        // Навигационные свойства
        public virtual User User { get; set; }
        public virtual Room Room { get; set; }

        public UserRoom()
        {
            JoinedAt = DateTime.UtcNow;
            LastActivity = DateTime.UtcNow;
            IsActive = true;
        }
    }

    /// <summary>
    /// Заблокированные пользователи
    /// </summary>
    [Table("BlockedUsers")]
    public class BlockedUser
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [MaxLength(50)]
        public string UserId { get; set; }

        [MaxLength(50)]
        public string BlockedUserId { get; set; }

        public DateTime BlockedAt { get; set; }

        // Навигационные свойства
        public virtual User User { get; set; }
        public virtual User Blocked { get; set; }

        public BlockedUser()
        {
            BlockedAt = DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Лог модерации
    /// </summary>
    [Table("ModerationLogs")]
    public class ModerationLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string LogId { get; set; }

        [MaxLength(50)]
        public string ModeratorId { get; set; }

        [MaxLength(50)]
        public string TargetUserId { get; set; }

        [MaxLength(50)]
        public string Action { get; set; } // mute, kick, ban, unban, warn, role_change

        public string Reason { get; set; }
        public DateTime Timestamp { get; set; }
        public int DurationMinutes { get; set; }
        public string DetailsJson { get; set; }

        // Навигационные свойства
        public virtual User Moderator { get; set; }
        public virtual User TargetUser { get; set; }

        public ModerationLog()
        {
            Timestamp = DateTime.UtcNow;
            DetailsJson = "{}";
        }
    }

    /// <summary>
    /// Системные настройки
    /// </summary>
    [Table("SystemSettings")]
    public class SystemSetting
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Key { get; set; }

        public string Value { get; set; }

        [MaxLength(500)]
        public string Description { get; set; }

        public DateTime UpdatedAt { get; set; }

        public SystemSetting()
        {
            UpdatedAt = DateTime.UtcNow;
        }
    }
}