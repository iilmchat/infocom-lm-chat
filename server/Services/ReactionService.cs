// Services/ReactionService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    public class ReactionService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<ReactionService> _logger;

        public ReactionService(ChatDbContext context, ILogger<ReactionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<bool> AddReactionAsync(string messageId, string userId, string reaction)
        {
            if (!ReactionTypes.IsValid(reaction))
                return false;

            await using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var existing = await _context.MessageReactions
                    .FirstOrDefaultAsync(mr => mr.MessageId == messageId && mr.UserId == userId);

                if (existing != null)
                {
                    if (existing.Reaction == reaction)
                    {
                        // Удаляем реакцию (toggle)
                        _context.MessageReactions.Remove(existing);
                    }
                    else
                    {
                        // Меняем реакцию
                        existing.Reaction = reaction;
                        existing.UpdatedAt = DateTime.UtcNow;
                    }
                }
                else
                {
                    var newReaction = new MessageReaction
                    {
                        MessageId = messageId,
                        UserId = userId,
                        Reaction = reaction
                    };
                    await _context.MessageReactions.AddAsync(newReaction);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, $"Ошибка добавления реакции на сообщение {messageId}");
                return false;
            }
        }

        public async Task<bool> RemoveReactionAsync(string messageId, string userId)
        {
            try
            {
                var reaction = await _context.MessageReactions
                    .FirstOrDefaultAsync(mr => mr.MessageId == messageId && mr.UserId == userId);

                if (reaction == null)
                    return false;

                _context.MessageReactions.Remove(reaction);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления реакции с сообщения {messageId}");
                return false;
            }
        }

        public async Task<Dictionary<string, int>> GetReactionsAsync(string messageId)
        {
            try
            {
                var reactions = await _context.MessageReactions
                    .Where(mr => mr.MessageId == messageId)
                    .GroupBy(mr => mr.Reaction)
                    .Select(g => new { Reaction = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(k => k.Reaction, v => v.Count);

                return reactions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения реакций для сообщения {messageId}");
                return new Dictionary<string, int>();
            }
        }

        public async Task<Dictionary<string, Dictionary<string, int>>> GetReactionsBatchAsync(IEnumerable<string> messageIds)
        {
            try
            {
                var reactions = await _context.MessageReactions
                    .Where(mr => messageIds.Contains(mr.MessageId))
                    .GroupBy(mr => mr.MessageId)
                    .Select(g => new
                    {
                        MessageId = g.Key,
                        Reactions = g.GroupBy(mr => mr.Reaction)
                            .Select(rg => new { Reaction = rg.Key, Count = rg.Count() })
                            .ToDictionary(k => k.Reaction, v => v.Count)
                    })
                    .ToDictionaryAsync(k => k.MessageId, v => v.Reactions);

                return reactions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения реакций для сообщений");
                return new Dictionary<string, Dictionary<string, int>>();
            }
        }

        public async Task<string> GetUserReactionAsync(string messageId, string userId)
        {
            try
            {
                var reaction = await _context.MessageReactions
                    .Where(mr => mr.MessageId == messageId && mr.UserId == userId)
                    .Select(mr => mr.Reaction)
                    .FirstOrDefaultAsync();

                return reaction;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения реакции пользователя {userId} на сообщение {messageId}");
                return null;
            }
        }
    }
}