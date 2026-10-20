// Services/SettingsService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис управления системными настройками
    /// </summary>
    public class SettingsService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<SettingsService> _logger;

        public SettingsService(ChatDbContext context, ILogger<SettingsService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Получение всех настроек
        /// </summary>
        public async Task<List<SystemSettingDto>> GetAllSettingsAsync()
        {
            try
            {
                var settings = await _context.SystemSettings.ToListAsync();
                return settings.Select(s => new SystemSettingDto
                {
                    Key = s.Key,
                    Value = s.Value,
                    Description = s.Description,
                    UpdatedAt = s.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения всех настроек");
                throw;
            }
        }

        /// <summary>
        /// Получение настройки по ключу
        /// </summary>
        public async Task<SystemSettingDto> GetSettingAsync(string key)
        {
            try
            {
                var setting = await _context.SystemSettings
                    .FirstOrDefaultAsync(s => s.Key == key);

                if (setting == null) return null;

                return new SystemSettingDto
                {
                    Key = setting.Key,
                    Value = setting.Value,
                    Description = setting.Description,
                    UpdatedAt = setting.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения настройки {key}");
                throw;
            }
        }

        /// <summary>
        /// Обновление или создание настройки
        /// </summary>
        public async Task<bool> SetSettingAsync(string key, string value, string description = null)
        {
            try
            {
                var setting = await _context.SystemSettings
                    .FirstOrDefaultAsync(s => s.Key == key);

                if (setting == null)
                {
                    setting = new SystemSetting
                    {
                        Key = key,
                        Value = value,
                        Description = description ?? key,
                        UpdatedAt = DateTime.UtcNow
                    };
                    await _context.SystemSettings.AddAsync(setting);
                }
                else
                {
                    setting.Value = value;
                    if (!string.IsNullOrEmpty(description))
                        setting.Description = description;
                    setting.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка установки настройки {key}");
                return false;
            }
        }

        /// <summary>
        /// Удаление настройки
        /// </summary>
        public async Task<bool> DeleteSettingAsync(string key)
        {
            try
            {
                var setting = await _context.SystemSettings
                    .FirstOrDefaultAsync(s => s.Key == key);

                if (setting == null) return false;

                _context.SystemSettings.Remove(setting);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления настройки {key}");
                return false;
            }
        }
    }
}