// Mappers/RoomMapper.cs
using System;
using System.Linq;
using System.Text.Json;
using InfocomChat.Server.Models;
using InfocomChat.Server.Models.Entities;

namespace InfocomChat.Server.Mappers
{
    /// <summary>
    /// Маппер для преобразования сущностей Room в RoomInfo и обратно
    /// </summary>
    public static class RoomMapper
    {
        /// <summary>
        /// Преобразует сущность Room в RoomInfo
        /// </summary>
        public static RoomInfo ToRoomInfo(this Room room)
        {
            if (room == null) return null;

            return new RoomInfo
            {
                RoomId = room.RoomId,
                Name = room.Name,
                Description = room.Description,
                CreatedAt = room.CreatedAt,
                CreatedBy = room.CreatedBy,
                MessageCount = room.MessageCount,
                LastActivity = room.LastActivity,
                Model = room.Model,
                IsPrivate = room.IsPrivate,
                Settings = !string.IsNullOrEmpty(room.SettingsJson)
                    ? JsonSerializer.Deserialize<RoomSettings>(room.SettingsJson)
                    : new RoomSettings(),
                //Metadata = !string.IsNullOrEmpty(room.MetadataJson)
                //    ? JsonSerializer.Deserialize<Dictionary<string, object>>(room.MetadataJson)
                //    : new Dictionary<string, object>()
            };
        }

        /// <summary>
        /// Преобразует RoomInfo в сущность Room
        /// </summary>
        public static Room ToRoomEntity(this RoomInfo roomInfo)
        {
            if (roomInfo == null) return null;

            return new Room
            {
                RoomId = roomInfo.RoomId,
                Name = roomInfo.Name,
                Description = roomInfo.Description,
                CreatedBy = roomInfo.CreatedBy,
                CreatedAt = roomInfo.CreatedAt,
                LastActivity = roomInfo.LastActivity,
                MessageCount = roomInfo.MessageCount,
                Model = roomInfo.Model,
                IsPrivate = roomInfo.IsPrivate,
                SettingsJson = roomInfo.Settings != null
                    ? JsonSerializer.Serialize(roomInfo.Settings)
                    : "{}",
                //MetadataJson = roomInfo.Metadata != null
                //    ? JsonSerializer.Serialize(roomInfo.Metadata)
                //    : "{}"
            };
        }
    }
}