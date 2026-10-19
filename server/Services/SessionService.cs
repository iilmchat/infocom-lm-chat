using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    public class SessionService : ISessionService
    {
        private readonly AppDbContext _context;

        public SessionService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<SessionDto>> GetUserSessionsAsync(int userId)
        {
            var sessions = await _context.Sessions
                .Where(s => s.UserId == userId && s.IsActive && s.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return sessions.Select(s => new SessionDto
            {
                Id = s.Id,
                TokenPreview = s.Token?.Length > 6 ? s.Token.Substring(0, 6) + "..." : "***",
                CreatedAt = s.CreatedAt,
                ExpiresAt = s.ExpiresAt,
                IsActive = s.IsActive
            }).ToList();
        }

        /*
        public async Task<List<SessionDto>> GetUserSessionsAsync(int userId)
        {
            var sessions = await _context.Sessions
                .Where(s => s.UserId == userId && s.IsActive && s.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return sessions.Select(s => new SessionDto
            {
                Id = s.Id,
                Token = s.Token,
                CreatedAt = s.CreatedAt,
                ExpiresAt = s.ExpiresAt,
                IsActive = s.IsActive
            }).ToList();
        }
        */

        public async Task<bool> EndSessionAsync(int sessionId, int userId)
        {
            var session = await _context.Sessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
            if (session == null || !session.IsActive) return false;
            session.IsActive = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> EndAllSessionsAsync(int userId)
        {
            var sessions = await _context.Sessions.Where(s => s.UserId == userId && s.IsActive).ToListAsync();
            if (!sessions.Any()) return false;
            foreach (var s in sessions) s.IsActive = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task SaveSessionAsync(int userId, string token, DateTime expiresAt)
        {
            _context.Sessions.Add(new Session
            {
                UserId = userId,
                Token = token,
                ExpiresAt = expiresAt,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            });
            await _context.SaveChangesAsync();
        }

        public async Task<bool> IsTokenValidAsync(string token)
        {
            var session = await _context.Sessions.FirstOrDefaultAsync(s => s.Token == token && s.IsActive && s.ExpiresAt > DateTime.UtcNow);
            return session != null;
        }

        public async Task<int?> GetUserIdByTokenAsync(string token)
        {
            var session = await _context.Sessions.FirstOrDefaultAsync(s => s.Token == token && s.IsActive && s.ExpiresAt > DateTime.UtcNow);
            return session?.UserId;
        }
    }
}