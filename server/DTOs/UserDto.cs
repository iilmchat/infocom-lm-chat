using System;
using System.Collections.Generic;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Полная информация о пользователе для клиента
    /// </summary>
    public class UserInfoDto
    {
        /// <summary>Уникальный идентификатор пользователя</summary>
        public string Id { get; set; }

        /// <summary>Отображаемое имя</summary>
        public string Name { get; set; }

        /// <summary>Аватар (эмодзи или URL)</summary>
        public string Avatar { get; set; }

        /// <summary>Аватар тип emoji/initials/image</summary>
        public string AvatarType { get; set; }

        /// <summary>Аватар base64</summary>
        public string AvatarData { get; set; }

        /// <summary>Цвет в HEX-формате</summary>
        public string Color { get; set; }

        /// <summary>Признак печатания в данный момент</summary>
        public bool IsTyping { get; set; }

        /// <summary>Время последней активности</summary>
        public DateTime LastSeen { get; set; }

        /// <summary>ID комнаты, в которой находится пользователь (если есть)</summary>
        public string RoomId { get; set; }

        /// <summary>Роль (Admin, Manager, User, Guest)</summary>
        public string Role { get; set; }

        /// <summary>Статус (online, away, busy, offline, banned)</summary>
        public string Status { get; set; }

        /// <summary>Признак онлайн</summary>        
        public bool IsOnline { get; set; }

        /// <summary>Причина бана (если забанен)</summary>
        public string BanReason { get; set; }

        /// <summary>Дата бана</summary>
        public DateTime? BannedAt { get; set; }

        /// <summary>До какого времени действует мут</summary>
        public DateTime? MutedUntil { get; set; }

        /// <summary>Количество комнат, в которых участвует пользователь</summary>
        public int RoomCount { get; set; }

        /// <summary>Количество отправленных сообщений</summary>
        public int MessageCount { get; set; }
        //public int UserCount { get; set; }

        /// <summary>Количество непрочитанных сообщений</summary>        
        public int UnreadCount { get; set; }

        /// <summary>Дата регистрации</summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>Дата последнего сообщения</summary>        
        public DateTime? LastMessageAt { get; set; }

        // Удалено в версии 5.2
        // public object ExtraData { get; set; }        
    }

    /// <summary>
    /// Краткая информация о пользователе для списков и превью
    /// </summary>
    public class UserInfoBriefDto
    {
        /// <summary>Идентификатор</summary>
        public string Id { get; set; }

        /// <summary>Имя</summary>
        public string Name { get; set; }

        /// <summary>Аватар</summary>
        public string Avatar { get; set; }
        /// <summary>Аватар тип emoji/initials/image</summary>
        public string AvatarType { get; set; }

        /// <summary>Аватар base64</summary>
        public string AvatarData { get; set; }

        /// <summary>Цвет</summary>
        public string Color { get; set; }

        /// <summary>Признак печатания</summary>
        public bool IsTyping { get; set; }

        /// <summary>Статус</summary>
        public string Status { get; set; }

        /// <summary>Признак онлайн</summary>
        public bool IsOnline { get; set; }        

        /// <summary>Время последней активности</summary>
        public DateTime LastSeen { get; set; }
    }

    /// <summary>
    /// DTO для обновления профиля пользователя
    /// DTO для обновления данных пользователя
    /// </summary>
    public class UpdateUserDto
    {
        /// <summary>Идентификатор</summary>
        public string Id { get; set; }

        /// <summary>Новое имя</summary>
        public string Name { get; set; }

        /// <summary>Новый аватар</summary>
        public string Avatar { get; set; }

        /// <summary>Тип нового аватара</summary>
        public string AvatarType { get; set; }

        /// <summary>Новый аватар (base64)</summary>
        public string AvatarData { get; set; }

        /// <summary>Новый цвет</summary>
        public string Color { get; set; }

        /// <summary>Новый статус</summary>
        public string Status { get; set; }
    }

    /// <summary>
    /// DTO для статуса пользователей в комнате
    /// </summary>
    public class RoomUsersDto
    {
        public string RoomId { get; set; }
        public List<UserInfoDto> Users { get; set; }
        public int OnlineCount { get; set; }
        public int TotalCount { get; set; }
    }

    /// <summary>
    /// DTO для статуса печатания
    /// </summary>
    public class TypingStatusDto
    {
        public string RoomId { get; set; }
        public string UserId { get; set; }
        public bool IsTyping { get; set; }
        public DateTime Timestamp { get; set; }
    }

    /// <summary>
    /// Ответ с информацией о пользователе
    /// </summary>
    public class UserResponseDto
    {
        public bool Success { get; set; }
        public UserInfoDto User { get; set; }
        public string Error { get; set; }
    }

    /// <summary>
    /// Список пользователей
    /// </summary>
    public class UsersListDto
    {
        public List<UserInfoDto> Users { get; set; }
        public int Total { get; set; }
        public int Online { get; set; }
    }
}