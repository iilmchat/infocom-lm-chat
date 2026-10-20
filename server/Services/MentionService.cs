// Services/MentionService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    public class MentionService
    {
        private readonly ChatDbContext _context;
        private readonly UserService _userService;
        private readonly ILogger<MentionService> _logger;

        public MentionService(ChatDbContext context, UserService userService, ILogger<MentionService> logger)
        {
            _context = context;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Извлечение упоминаний из текста
        /// </summary>
        public List<string> ExtractMentions(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return new List<string>();

            var mentions = new List<string>();
            var regex = new Regex(@"@(\w+)");
            var matches = regex.Matches(text);

            foreach (Match match in matches)
            {
                if (match.Success && match.Groups.Count > 1)
                {
                    mentions.Add(match.Groups[1].Value);
                }
            }

            return mentions.Distinct().ToList();
        }

        /// <summary>
        /// Проверка, существует ли пользователь с таким именем
        /// </summary>
        public async Task<User> GetUserByNameAsync(string name)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Name == name || u.UserId == name);
        }

        /// <summary>
        /// Создание упоминаний для сообщения
        /// </summary>
        public async Task<List<Mention>> CreateMentionsAsync(string messageId, string content, string mentionedBy)
        {
            var result = new List<Mention>();
            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var mentions = ExtractMentions(content);

                foreach (var mention in mentions)
                {
                    var user = await GetUserByNameAsync(mention);
                    if (user == null)
                        continue;

                    // Пропускаем, если пользователь упомянул сам себя
                    if (user.UserId == mentionedBy)
                        continue;

                    var mentionEntity = new Mention
                    {
                        MessageId = messageId,
                        UserId = user.UserId,
                        MentionedBy = mentionedBy,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _context.Mentions.AddAsync(mentionEntity);
                    result.Add(mentionEntity);
                }

                if (result.Any())
                {
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    _logger.LogInformation($"Создано {result.Count} упоминаний для сообщения {messageId}");
                }

                return result;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка создания упоминаний для сообщения {messageId}");
                throw;
            }
        }

        /// <summary>
        /// Получение непрочитанных упоминаний для пользователя
        /// </summary>
        public async Task<List<Mention>> GetUnreadMentionsAsync(string userId)
        {
            return await _context.Mentions
                .Include(m => m.Message)
                .Include(m => m.MentionedByUser)
                .Where(m => m.UserId == userId && !m.IsRead)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();
        }

        /// <summary>
        /// Отметка упоминаний как прочитанных
        /// </summary>
        public async Task<bool> MarkMentionsAsReadAsync(string userId, List<string> mentionIds = null)
        {
            try
            {
                var query = _context.Mentions
                    .Where(m => m.UserId == userId && !m.IsRead);

                if (mentionIds != null && mentionIds.Any())
                {
                    query = query.Where(m => mentionIds.Contains(m.MentionId));
                }

                var mentions = await query.ToListAsync();

                foreach (var mention in mentions)
                {
                    mention.IsRead = true;
                    mention.ReadAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка отметки упоминаний как прочитанных для {userId}");
                return false;
            }
        }

        /// <summary>
        /// Получение количества непрочитанных упоминаний
        /// </summary>
        public async Task<int> GetUnreadMentionsCountAsync(string userId)
        {
            return await _context.Mentions
                .CountAsync(m => m.UserId == userId && !m.IsRead);
        }

        /// <summary>
        /// Форматирование текста с подсветкой упоминаний
        /// </summary>
        public string HighlightMentions(string text, string currentUserId)
        {
            if (string.IsNullOrWhiteSpace(text))
                return text;

            var regex = new Regex(@"@(\w+)");
            return regex.Replace(text, match =>
            {
                var name = match.Groups[1].Value;
                // Здесь можно добавить логику для определения, является ли это упоминанием текущего пользователя
                return $"<span class=\"mention\">{match.Value}</span>";
            });
        }
    }
}