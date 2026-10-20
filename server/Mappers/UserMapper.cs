using System;
using System.Collections.Generic;
using System.Linq;
using InfocomChat.Server.Models.Entities;
using InfocomChat.Server.DTOs;

namespace InfocomChat.Server.Mappers
{
    /// <summary>
    /// Маппер для преобразования сущностей в DTO
    /// </summary>
    public static class UserMapper
    {
        /// <summary>
        /// Преобразует сущность User в UserInfoDto
        /// </summary>
        public static UserInfoDto ToUserInfoDto(this User user)
        {
            if (user == null) return null;

            return new UserInfoDto
            {
                Id = user.UserId,
                Name = user.Name,
                Avatar = user.Avatar,
                AvatarType = user.AvatarType,
                AvatarData = user.AvatarData,
                Color = user.Color,
                IsTyping = false, // Не передаем из сущности, будет обновляться отдельно
                LastSeen = user.LastSeen,
                RoomId = null, // Будет заполнено при необходимости
                Role = user.Role,
                Status = user.Status,
                MessageCount = user.MessageCount,
                UnreadCount = user.UnreadCount,
                IsOnline = user.IsOnline,
                BanReason = user.BanReason,
                BannedAt = user.BannedAt,
                MutedUntil = user.MutedUntil,
                RoomCount = user.UserRooms?.Count ?? 0,
                CreatedAt = user.CreatedAt//,
                //ExtraData = null // Не передаем из сущности
            };
        }

        /// <summary>
        /// Преобразует сущность User в UserInfoBriefDto
        /// </summary>
        public static UserInfoBriefDto ToUserInfoBriefDto(this User user)
        {
            if (user == null) return null;

            return new UserInfoBriefDto
            {
                Id = user.UserId,
                Name = user.Name,
                Avatar = user.Avatar,
                AvatarType = user.AvatarType,
                AvatarData = user.AvatarData,
                Color = user.Color,
                IsTyping = false, // Не передаем из сущности, будет обновляться отдельно
                Status = user.Status,
                IsOnline = user.IsOnline,
                LastSeen = user.LastSeen
            };
        }

        /// <summary>
        /// Преобразует коллекцию пользователей в список UserInfoDto
        /// </summary>
        public static List<UserInfoDto> ToUserInfoDtos(this IEnumerable<User> users)
        {
            return users?.Select(u => u.ToUserInfoDto()).ToList() ?? new List<UserInfoDto>();
        }

        /// <summary>
        /// Преобразует коллекцию пользователей в список UserInfoBriefDto
        /// </summary>
        public static List<UserInfoBriefDto> ToUserInfoBriefDtos(this IEnumerable<User> users)
        {
            return users?.Select(u => u.ToUserInfoBriefDto()).ToList() ?? new List<UserInfoBriefDto>();
        }

        /// <summary>
        /// Преобразует сущность User в UpdateUserDto
        /// </summary>
        public static UpdateUserDto ToUpdateUserDto(this User user)
        {
            if (user == null) return null;

            return new UpdateUserDto
            {
                Id = user.UserId,
                Name = user.Name,
                Avatar = user.Avatar,
                AvatarType = user.AvatarType,
                AvatarData = user.AvatarData,
                Color = user.Color,
                Status = user.Status
            };
        }
    }
}
