// Models/Entities/MessageReaction.cs
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;

namespace InfocomChat.Server.Models.Entities
{
    [Table("MessageReactions")]
    public class MessageReaction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string MessageId { get; set; }

        [Required]
        [MaxLength(50)]
        public string UserId { get; set; }

        [Required]
        [MaxLength(10)]
        public string Reaction { get; set; } // 👍, ❤️, 😄, 😮, 😢, 😡

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Навигационные свойства
        public virtual PrivateMessage Message { get; set; }
        public virtual User User { get; set; }

        public MessageReaction()
        {
            CreatedAt = DateTime.UtcNow;
        }
    }

    public static class ReactionTypes
    {
        public const string Like = "👍";
        public const string Heart = "❤️";
        public const string Laugh = "😄";
        public const string Surprise = "😮";
        public const string Sad = "😢";
        public const string Angry = "😡";
        public const string Rocket = "🚀";
        public const string Fire = "🔥";
        public const string Star = "⭐";

        public static readonly string[] All = { Like, Heart, Laugh, Surprise, Sad, Angry, Rocket, Fire, Star };

        public static bool IsValid(string reaction) => All.Contains(reaction);
        /*
        public static bool IsValid(string reaction)
        {
            return Array.IndexOf(All, reaction) >= 0;
        }
        */
    }
}