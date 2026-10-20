// DTOs/ReactionDtos.cs
using System.Collections.Generic;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Информация о реакции на сообщение
    /// </summary>
    public class ReactionDto
    {
        /// <summary>Символ реакции (например, "👍")</summary>
        public string Reaction { get; set; }

        /// <summary>Количество пользователей, поставивших эту реакцию</summary>
        public int Count { get; set; }

        /// <summary>Список ID пользователей, поставивших реакцию (опционально)</summary>
        public List<string> UserIds { get; set; }
    }
}