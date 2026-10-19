using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Документ проекта с поддержкой версионности
    /// </summary>
    public class Document
    {
        public int Id { get; set; }

        /// <summary>Идентификатор проекта</summary>
        public int ProjectId { get; set; }
        public Project Project { get; set; }

        /// <summary>Тип документа: "ИД", "Проект", "ТТ", "ПиМ ПСИ", "ЦБИ"</summary>
        public string Type { get; set; }

        /// <summary>Номер версии (начинается с 1)</summary>
        public int Version { get; set; }

        /// <summary>Заголовок документа</summary>
        public string Title { get; set; }

        /// <summary>Содержимое документа (текст)</summary>
        public string Content { get; set; }

        /// <summary>Дата создания версии</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Дата последнего обновления</summary>
        public DateTime UpdatedAt { get; set; }

        /// <summary>Кто создал версию</summary>
        public int CreatedBy { get; set; }
        public User Creator { get; set; }

        /// <summary>Признак активной (текущей) версии</summary>
        public bool IsActive { get; set; }

        /// <summary>Признак принятой версии (утверждена владельцем)</summary>
        public bool IsAccepted { get; set; }

        /// <summary>Дата принятия</summary>
        public DateTime? AcceptedAt { get; set; }

        /// <summary>Кто принял</summary>
        public int? AcceptedBy { get; set; }
        public User Acceptor { get; set; }
    }
}