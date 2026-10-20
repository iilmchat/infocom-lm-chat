// DTO/Response/PrivateChatDto.cs

using System;
using System.Collections.Generic;
using InfocomChat.Server.Models;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// DTO для представления приватного чата в ответе API
    /// Информация о приватном чате
    /// </summary>
    public class PrivateChatDto
    {
        /// <summary>Уникальный идентификатор чата</summary>
        public string ChatId { get; set; }

        /// <summary>ID первого пользователя</summary>
        public string User1Id { get; set; }

        /// <summary>ID второго пользователя</summary>
        public string User2Id { get; set; }

        /// <summary>Текст последнего сообщения</summary>
        public string LastMessage { get; set; }

        /// <summary>Время последнего сообщения</summary>
        public DateTime? LastMessageAt { get; set; }

        /// <summary>Дата создания чата</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Время последней активности</summary>
        public DateTime LastActivity { get; set; }

        /// <summary>Активен ли чат</summary>
        public bool IsActive { get; set; }

        /// <summary>Краткая информация о первом пользователе</summary>
        public UserPreviewDto User1 { get; set; }

        /// <summary>Краткая информация о втором пользователе</summary>
        public UserPreviewDto User2 { get; set; }

        // Список сообщений (без циклических ссылок)
        /// <summary>Список сообщений (если загружены)</summary>        
        public List<PrivateMessageDto> PrivateMessages { get; set; } = new List<PrivateMessageDto>();
    }



    /// <summary>
    /// DTO для представления сообщения в приватном чате
    /// Сообщение в приватном чате
    /// </summary>
    public class PrivateMessageDto
    {
        /// <summary>Идентификатор сообщения</summary>
        public string MessageId { get; set; }

        /// <summary>ID чата</summary>
        public string ChatId { get; set; }

        /// <summary>ID отправителя</summary>
        public string SenderId { get; set; }

        /// <summary>ID получателя</summary>
        public string ReceiverId { get; set; }

        /// <summary>Имя отправителя</summary>
        public string SenderName { get; set; }

        /// <summary>Аватар отправителя</summary>
        public string SenderAvatar { get; set; }

        /// <summary>Аватар отправителя(тип)</summary>
        public string SenderAvatarType { get; set; }

        /// <summary>Аватар отправителя(base64)</summary>
        public string SenderAvatarData { get; set; }

        /// <summary>Текст сообщения</summary>
        public string Content { get; set; }

        /// <summary>Время отправки</summary>
        public DateTime Timestamp { get; set; }

        /// <summary>Прочитано ли</summary>
        public bool IsRead { get; set; }

        /// <summary>Время прочтения</summary>
        public DateTime? ReadAt { get; set; }

        /// <summary>ID сообщения, на которое дан ответ</summary>
        public string ReplyToId { get; set; }

        /// <summary>Отредактировано ли</summary>
        public bool IsEdited { get; set; }

        /// <summary>Время редактирования</summary>
        public DateTime? EditedAt { get; set; }

        /// <summary>Вложения (файлы)</summary>        
        public List<FileAttachment> Attachments { get; set; }
        public string AttachmentsJson { get; set; }    

        // Удалено в версии 5.2
        // public object ExtraData { get; set; }            
    }

    /// <summary>
    /// Краткая информация о пользователе для встраивания в другие DTO
    /// </summary>
    public class UserPreviewDto
    {
        /// <summary>Идентификатор</summary>
        public string UserId { get; set; }

        /// <summary>Имя</summary>
        public string Name { get; set; }

        /// <summary>Аватар</summary>
        public string Avatar { get; set; }
        public string AvatarType { get; set; }
        public string AvatarData { get; set; }

        /// <summary>Цвет</summary>
        public string Color { get; set; }

        /// <summary>Статус</summary>
        public string Status { get; set; }

        /// <summary>Признак онлайн</summary>
        public bool IsOnline { get; set; }
    }

    /// <summary>
    /// DTO для представления списка чатов пользователя
    /// </summary>
    public class UserChatsResponseDto
    {
        public bool Success { get; set; }

        public List<PrivateChatDto> Chats { get; set; } = new List<PrivateChatDto>();
    }
}
