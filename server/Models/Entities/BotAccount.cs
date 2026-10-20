// Models/Entities/BotAccount.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InfocomChat.Server.Models.Entities
{
    /// <summary>
    /// Аккаунт бота для интеграции
    /// </summary>
    [Table("BotAccounts")]
    public class BotAccount
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string BotId { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(100)]
        public string Name { get; set; }

        [MaxLength(10)]
        public string Avatar { get; set; }

        [Required]
        [MaxLength(100)]
        public string ApiKey { get; set; } = Guid.NewGuid().ToString().Replace("-", "");

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string OwnerId { get; set; }

        // Навигационное свойство
        public virtual User Owner { get; set; }
    }
}