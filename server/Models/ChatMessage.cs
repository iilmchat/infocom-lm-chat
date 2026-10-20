// Models/ChatMessage.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace InfocomChat.Server.Models
{
    /// <summary>
    /// Модель сообщения чата с валидацией
    /// </summary>
    public class ChatMessage
    {
        /// <summary>Уникальный идентификатор сообщения</summary>
        [Required(ErrorMessage = "Id сообщения обязателен")]
        [MaxLength(50, ErrorMessage = "Id не может быть длиннее 50 символов")]
        public string Id { get; set; }

        /// <summary>Идентификатор комнаты</summary>
        [Required(ErrorMessage = "RoomId обязателен")]
        [MaxLength(50, ErrorMessage = "RoomId не может быть длиннее 50 символов")]
        public string RoomId { get; set; }

        /// <summary>Идентификатор отправителя</summary>
        [Required(ErrorMessage = "UserId обязателен")]
        [MaxLength(50, ErrorMessage = "UserId не может быть длиннее 50 символов")]
        public string UserId { get; set; }

        /// <summary>Имя отправителя</summary>
        [Required(ErrorMessage = "UserName обязателен")]
        [MaxLength(100, ErrorMessage = "UserName не может быть длиннее 100 символов")]
        public string UserName { get; set; }

        /// <summary>Аватар отправителя</summary>
        [MaxLength(10, ErrorMessage = "Avatar не может быть длиннее 10 символов")]
        public string UserAvatar { get; set; }

        /// <summary>Роль отправителя (user/assistant/system)</summary>
        [Required(ErrorMessage = "Role обязателен")]
        [MaxLength(20, ErrorMessage = "Role не может быть длиннее 20 символов")]
        public string Role { get; set; } // "user" | "assistant"

        /// <summary>Текст сообщения (макс. 10000 символов)</summary>
        [Required(ErrorMessage = "Content обязателен")]
        [MaxLength(10000, ErrorMessage = "Сообщение не может быть длиннее 10000 символов")]
        public string Content { get; set; }
        
        /// <summary>Время отправки сообщения</summary>
        public DateTime Timestamp { get; set; }

        /// <summary>ID сообщения, на которое отвечаем</summary>
        [MaxLength(50, ErrorMessage = "ReplyToId не может быть длиннее 50 символов")]
        public string ReplyToId { get; set; }

        /// <summary>Признак редактирования сообщения</summary>
        public bool IsEdited { get; set; }

        /// <summary>Используемая модель</summary>
        [MaxLength(50, ErrorMessage = "Model не может быть длиннее 50 символов")]
        public string Model { get; set; }

        /// <summary>Вложения (файлы)</summary>
        public List<FileAttachment> Attachments { get; set; }

        /// <summary>Дополнительные метаданные</summary>
        public Dictionary<string, object> Metadata { get; set; }

        /// <summary>Конструктор с инициализацией коллекций</summary>
        public ChatMessage()
        {
            Id = Guid.NewGuid().ToString();
            Timestamp = DateTime.UtcNow;
            Role = "user";
            Attachments = new List<FileAttachment>();
            Metadata = new Dictionary<string, object>();
        }        
    }

    /// <summary>
    /// Модель вложения (файла) с валидацией
    /// </summary>
    public class FileAttachment
    {
        /// <summary>Имя файла</summary>
        [Required(ErrorMessage = "Имя файла обязательно")]
        [MaxLength(255, ErrorMessage = "Имя файла не может быть длиннее 255 символов")]
        public string Name { get; set; }

        /// <summary>Содержимое файла в Base64</summary>
        [MaxLength(10 * 1024 * 1024, ErrorMessage = "Файл не может быть больше 10 МБ")]
        public string Content { get; set; }

        /// <summary>Размер файла в байтах</summary>
        [Range(0, 10 * 1024 * 1024, ErrorMessage = "Файл не может быть больше 10 МБ")]
        public long Size { get; set; }

        /// <summary>MIME-тип файла</summary>
        [MaxLength(100, ErrorMessage = "MIME-тип не может быть длиннее 100 символов")]
        public string Type { get; set; }

        /// <summary>Проверка валидности вложения</summary>
        public bool IsValid()
        {
            return !string.IsNullOrEmpty(Name) && Size > 0 && Size <= 10 * 1024 * 1024;
        }        
    }

    /// <summary>
    /// Модель для отправки сообщения с валидацией
    /// </summary>
    public class SendMessageRequest
    {
        /// <summary>ID комнаты</summary>
        [Required(ErrorMessage = "RoomId обязателен")]
        [MaxLength(50, ErrorMessage = "RoomId не может быть длиннее 50 символов")]
        public string RoomId { get; set; }

        /// <summary>ID отправителя</summary>
        [Required(ErrorMessage = "UserId обязателен")]
        [MaxLength(50, ErrorMessage = "UserId не может быть длиннее 50 символов")]
        public string UserId { get; set; }

        /// <summary>Имя отправителя</summary>
        [Required(ErrorMessage = "UserName обязателен")]
        [MaxLength(100, ErrorMessage = "UserName не может быть длиннее 100 символов")]
        public string UserName { get; set; }

        /// <summary>Аватар отправителя</summary>
        [MaxLength(10, ErrorMessage = "Avatar не может быть длиннее 10 символов")]
        public string UserAvatar { get; set; }

        /// <summary>Текст сообщения</summary>
        [Required(ErrorMessage = "Content обязателен")]
        [MaxLength(10000, ErrorMessage = "Сообщение не может быть длиннее 10000 символов")]
        public string Content { get; set; }

        /// <summary>Роль отправителя</summary>
        [MaxLength(20, ErrorMessage = "Role не может быть длиннее 20 символов")]
        public string Role { get; set; }

        /// <summary>ID сообщения, на которое отвечаем</summary>
        [MaxLength(50, ErrorMessage = "ReplyToId не может быть длиннее 50 символов")]
        public string ReplyToId { get; set; }

        /// <summary>Используемая модель</summary>
        [MaxLength(50, ErrorMessage = "Model не может быть длиннее 50 символов")]
        public string Model { get; set; }

        /// <summary>Вложения</summary>
        public List<FileAttachment> Attachments { get; set; }

        /// <summary>Конструктор с инициализацией</summary>
        public SendMessageRequest()
        {
            Role = "user";
            Model = "local-model";
            Attachments = new List<FileAttachment>();
        }

        /// <summary>Валидация запроса</summary>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(RoomId) &&
                   !string.IsNullOrWhiteSpace(UserId) &&
                   !string.IsNullOrWhiteSpace(UserName) &&
                   !string.IsNullOrWhiteSpace(Content) &&
                   Content.Length <= 10000;
        }
    }

    /// <summary>
    /// Ответ на отправку сообщения
    /// </summary>
    public class SendMessageResponse
    {
        public bool Success { get; set; }
        public ChatMessage Message { get; set; }
        public string Error { get; set; }
        public List<string> Mentions { get; set; }

        public SendMessageResponse()
        {
            Mentions = new List<string>();
        }
    }

    /// <summary>
    /// Запрос на редактирование сообщения
    /// </summary>
    public class EditMessageRequest
    {
        /// <summary>ID комнаты</summary>
        [Required(ErrorMessage = "RoomId обязателен")]
        [MaxLength(50, ErrorMessage = "RoomId не может быть длиннее 50 символов")]
        public string RoomId { get; set; }

        /// <summary>ID сообщения</summary>
        [Required(ErrorMessage = "MessageId обязателен")]
        [MaxLength(50, ErrorMessage = "MessageId не может быть длиннее 50 символов")]
        public string MessageId { get; set; }

        /// <summary>ID пользователя</summary>
        [Required(ErrorMessage = "UserId обязателен")]
        [MaxLength(50, ErrorMessage = "UserId не может быть длиннее 50 символов")]
        public string UserId { get; set; }

        /// <summary>Новый текст сообщения</summary>
        [Required(ErrorMessage = "NewContent обязателен")]
        [MaxLength(10000, ErrorMessage = "Сообщение не может быть длиннее 10000 символов")]
        public string NewContent { get; set; }
    }
    /*
    public class UserInfo
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Avatar { get; set; }
        public string Color { get; set; }
        public bool IsTyping { get; set; }
        public DateTime LastSeen { get; set; }
        public string RoomId { get; set; }
    }
    */
    /*
    public class RoomInfo
    {
        public string RoomId { get; set; }
        public string Name { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<UserInfo> Users { get; set; }
        public List<ChatMessage> Messages { get; set; }
        public string Model { get; set; }
        public int MessageCount { get; set; }
        public DateTime LastActivity { get; set; }
    }
    */
}