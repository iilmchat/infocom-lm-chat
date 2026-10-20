// DTOs/SettingsDtos.cs
using System.Collections.Generic;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Системная настройка
    /// </summary>
    public class SystemSettingDto
    {
        public string Key { get; set; }
        public string Value { get; set; }
        public string Description { get; set; }
        public string UpdatedAt { get; set; }
    }

    /// <summary>
    /// Запрос на обновление/добавление настройки
    /// </summary>
    public class SetSystemSettingRequest
    {
        public string Key { get; set; }
        public string Value { get; set; }
        public string Description { get; set; }
    }
}