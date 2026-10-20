// Services/UserService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models.Entities;
using InfocomChat.Server.DTOs;
using InfocomChat.Server.Mappers;
using Microsoft.Extensions.Logging;

namespace InfocomChat.Server.Services
{
    /// <summary>
    /// Сервис управления пользователями и ролями
    /// </summary>
    public class UserService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<UserService> _logger;

        /// <summary>
        /// Статические определения ролей системы
        /// </summary>
        public static class Roles
        {
            public const string Admin = "Admin";
            public const string Manager = "Manager";
            public const string User = "User";
            public const string Guest = "Guest";

            public static readonly string[] AllRoles = { Admin, Manager, User, Guest };

            /// <summary>
            /// Проверка валидности роли
            /// </summary>
            public static bool IsValidRole(string role) => AllRoles.Contains(role);

            /// <summary>
            /// Получение приоритета роли (чем выше число, тем выше приоритет)
            /// </summary>
            public static int GetPriority(string role) => role switch
            {
                Admin => 4,
                Manager => 3,
                User => 2,
                Guest => 1,
                _ => 0
            };

            /// <summary>
            /// Проверка, имеет ли роль1 приоритет выше или равный роли2
            /// </summary>
            public static bool HasHigherOrEqualPriority(string role1, string role2)
            {
                return GetPriority(role1) >= GetPriority(role2);
            }
        }

        public UserService(ChatDbContext context, ILogger<UserService> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ===== ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ПОЛУЧЕНИЯ ОТСЛЕЖИВАЕМОЙ СУЩНОСТИ =====
        /// <summary>
        /// Получение сущности пользователя из контекста (для последующего обновления)
        /// </summary>
        private async Task<User> GetUserEntityAsync(string userId, CancellationToken cancellationToken = default)
        {
            return await _context.Users
                .Include(u => u.UserRooms)
                .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
        }

        // ===== ПУБЛИЧНЫЕ МЕТОДЫ С CANCELATIONTOKEN =====
        
        /// <summary>
        /// Получение DTO пользователя по ID
        /// </summary>
        public async Task<UserInfoDto> GetUserAsync(string userId, CancellationToken cancellationToken = default)
        {
            var user = await GetUserEntityAsync(userId, cancellationToken);
            return user?.ToUserInfoDto();
        }

        /// <summary>
        /// Получение модели пользователя по ID ВОЗМОЖНО не НУЖНО
        /// </summary>
        public async Task<User> GetUserModelAsync(string userId)
        {
            return await _context.Users
                .Include(u => u.UserRooms)
                .FirstOrDefaultAsync(u => u.UserId == userId);

        }

        /// <summary>
        /// Получение пользователя по ID с блокировками
        /// </summary>
        public async Task<UserInfoDto> GetUserWithBlocksAsync(string userId, CancellationToken cancellationToken = default)
        {
            var user = await _context.Users
                .Include(u => u.BlockedUsers)
                .Include(u => u.BlockedBy)
                .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
            return user?.ToUserInfoDto();
        }

        /// <summary>
        /// Получение или создание пользователя с транзакцией
        /// </summary>
        public async Task<UserInfoDto> GetOrCreateUserAsync(
            string userId, 
            string name, 
            string avatar, 
            string color,
            string avatartype,
            string avatardata,
            CancellationToken cancellationToken = default)
        {
            // Начинаем транзакцию для обеспечения целостности данных
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                // Используем метод для получения отслеживаемой сущности
                //var user = await GetUserModelAsync(userId);
                var user = await GetUserEntityAsync(userId, cancellationToken);

                if (user != null)
                {
                    // Обновляем информацию о существующем пользователе
                    user.Name = name;
                    user.Avatar = avatar;
                    user.Color = color;
                    user.AvatarType = avatartype;
                    user.AvatarData = avatardata;

                    user.LastSeen = DateTime.UtcNow;
                    user.IsOnline = true;
                    user.Status = "online";

                    await _context.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    _logger.LogInformation($"Обновлён пользователь: {userId}");
                    return user.ToUserInfoDto();
                }

                // Получаем роль по умолчанию
                var defaultRole = await GetDefaultRoleAsync(cancellationToken);
                var anyUser = await _context.Users.AnyAsync(cancellationToken);

                // Если это первый пользователь, делаем его администратором
                if (!anyUser)
                {
                    defaultRole = Roles.Admin;
                }

                // Создаём нового пользователя
                var userNew = new User
                {
                    UserId = userId,
                    Name = name,
                    Avatar = avatar,
                    Color = color,
                    Role = defaultRole,
                    IsOnline = true,
                    Status = "online",
                    CreatedAt = DateTime.UtcNow,
                    LastSeen = DateTime.UtcNow
                };

                await _context.Users.AddAsync(userNew, cancellationToken);
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation($"Создан новый пользователь: {userId} с ролью {defaultRole}");

                return userNew.ToUserInfoDto();
            }
            catch (Exception ex)
            {
                // Откатываем транзакцию в случае ошибки
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка при создании пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Получение роли по умолчанию для новых пользователей из настроек системы (Admin)
        /// </summary>
        public async Task<string> GetDefaultRoleAsync(CancellationToken cancellationToken = default)
        {
            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "DefaultRole", cancellationToken);

            if (setting != null && Roles.IsValidRole(setting.Value))
            {
                return setting.Value;
            }

            return Roles.Admin;
        }

        /// <summary>
        /// Установка роли по умолчанию
        /// </summary>
        public async Task<bool> SetDefaultRoleAsync(string role, CancellationToken cancellationToken = default)
        {
            if (!Roles.IsValidRole(role))
            {
                return false;
            }

            var setting = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == "DefaultRole", cancellationToken);

            if (setting == null)
            {
                setting = new SystemSetting
                {
                    Key = "DefaultRole",
                    Value = role,
                    Description = "Роль по умолчанию для новых пользователей"
                };
                await _context.SystemSettings.AddAsync(setting, cancellationToken);
            }
            else
            {
                setting.Value = role;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        // ===== ПРОВЕРКИ (вынесены для переиспользования) =====        

        /// <summary>
        /// Проверка, забанен ли пользователь
        /// </summary>
        public async Task<bool> IsUserBannedAsync(string userId, CancellationToken cancellationToken = default)
        {
            var user = await GetUserEntityAsync(userId, cancellationToken);            
            //var user = await GetUserModelAsync(userId);
            if (user == null) return false;
            return user.Status == "banned" || user.BannedAt.HasValue;
        }     
               
        /// <summary>
        /// Проверка, заглушен ли пользователь
        /// </summary>
        public async Task<bool> IsUserMutedAsync(string userId, CancellationToken cancellationToken = default)
        {
            var user = await GetUserEntityAsync(userId, cancellationToken);
            if (user == null) return false;

            if (user.MutedUntil.HasValue && user.MutedUntil.Value > DateTime.UtcNow)
                return true;

            // Сбрасываем истекший мут
            if (user.MutedUntil.HasValue)
            {
                user.MutedUntil = null;
                await _context.SaveChangesAsync(cancellationToken);
            }
            return false;
        }

        /// <summary>
        /// Проверка наличия у пользователя требуемой роли
        /// </summary>
        public async Task<bool> HasRoleAsync(string userId, string requiredRole, CancellationToken cancellationToken = default)
        {
            var user = await GetUserEntityAsync(userId, cancellationToken);
            if (user == null) return false;
            return Roles.GetPriority(user.Role) >= Roles.GetPriority(requiredRole);
        }

        /// <summary>
        /// Проверка, является ли пользователь администратором
        /// </summary>
        public async Task<bool> IsAdminAsync(string userId, CancellationToken cancellationToken = default)
        {
            return await HasRoleAsync(userId, Roles.Admin, cancellationToken);
        }

        /// <summary>
        /// Проверка, является ли пользователь модератором (или выше)
        /// </summary>
        public async Task<bool> IsModeratorAsync(string userId, CancellationToken cancellationToken = default)
        {
            return await HasRoleAsync(userId, Roles.Manager, cancellationToken);
        }

        // ===== УПРАВЛЕНИЕ РОЛЯМИ =====
 
        /// <summary>
        /// Изменение роли пользователя с транзакцией
        /// </summary>
        public async Task<bool> SetUserRoleAsync(
            string userId, 
            string role, 
            string moderatorId = null,
            CancellationToken cancellationToken = default)
        {
            if (!Roles.IsValidRole(role))
            {
                return false;
            }

            //await using var transaction = await _context.Database.BeginTransactionAsync();
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                //var user = await GetUserModelAsync(userId);
                var user = await GetUserEntityAsync(userId, cancellationToken);                
                if (user == null)
                {
                    return false;
                }

                // Проверка прав модератора
                if (!string.IsNullOrEmpty(moderatorId))
                {
                    //var moderator = await GetUserModelAsync(moderatorId);
                    var moderator = await GetUserEntityAsync(moderatorId, cancellationToken);                    
                    if (moderator == null || 
                        !Roles.HasHigherOrEqualPriority(moderator.Role, Roles.Manager))
                    {
                        return false;
                    }

                    // Модератор не может назначить роль выше своей
                    if (Roles.GetPriority(role) > Roles.GetPriority(moderator.Role))
                    {
                        return false;
                    }
                }

                var oldRole = user.Role;
                user.Role = role;
                await _context.SaveChangesAsync(cancellationToken);

                // Логируем изменение роли
                if (!string.IsNullOrEmpty(moderatorId))
                {
                    await LogModerationAsync(
                        moderatorId,
                        userId,
                        "role_change",
                        $"Изменена роль с {oldRole} на {role}",
                        0,
                        cancellationToken
                    );
                }

                await transaction.CommitAsync(cancellationToken);
                _logger.LogInformation($"Роль пользователя {userId} изменена с {oldRole} на {role}");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка изменения роли пользователя {userId}");
                throw;
            }
        }

        // ===== ПОЛУЧЕНИЕ СПИСКОВ =====

        /// <summary>
        /// Получение всех пользователей
        /// </summary>
        public async Task<List<UserInfoDto>> GetAllUsersAsync(CancellationToken cancellationToken = default)
        {
            var users = await _context.Users
                .Include(u => u.UserRooms)
                .OrderBy(u => u.Name)
                .ToListAsync(cancellationToken);
            return users.ToUserInfoDtos();
        }

        /// <summary>
        /// Получение списка пользователей в комнате (с фильтрацией по комнате)
        /// </summary>
        public async Task<List<UserInfoDto>> GetUsersInRoomAsync(string roomId, CancellationToken cancellationToken = default)
        {
            var users = await _context.Users
                .Include(u => u.UserRooms)
                .Where(u => u.UserRooms.Any(ur => ur.RoomId == roomId))
                .ToListAsync(cancellationToken);

            return users.ToUserInfoDtos();
        }

        /// <summary>
        /// Получение пользователей с пагинацией (новый метод) Возможно пагинацию надо переделать
        /// </summary>
        public async Task<PaginatedResponse<User>> GetUsersPaginatedAsync(
            PaginatedRequest request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var query = _context.Users
                    .Include(u => u.UserRooms)
                    .AsQueryable();

                // Применяем поиск, если указан
                if (!string.IsNullOrWhiteSpace(request.SearchTerm))
                {
                    var search = request.SearchTerm.ToLower();
                    query = query.Where(u => 
                        u.Name.ToLower().Contains(search) || 
                        u.UserId.ToLower().Contains(search) ||
                        (u.Email != null && u.Email.ToLower().Contains(search)));
                }

                // Применяем сортировку
                if (!string.IsNullOrEmpty(request.SortBy))
                {
                    query = request.SortBy.ToLower() switch
                    {
                        "name" => request.SortDescending 
                            ? query.OrderByDescending(u => u.Name) 
                            : query.OrderBy(u => u.Name),
                        "createdat" => request.SortDescending 
                            ? query.OrderByDescending(u => u.CreatedAt) 
                            : query.OrderBy(u => u.CreatedAt),
                        "lastseen" => request.SortDescending 
                            ? query.OrderByDescending(u => u.LastSeen) 
                            : query.OrderBy(u => u.LastSeen),
                        "messagecount" => request.SortDescending 
                            ? query.OrderByDescending(u => u.MessageCount) 
                            : query.OrderBy(u => u.MessageCount),
                        _ => request.SortDescending 
                            ? query.OrderByDescending(u => u.Name) 
                            : query.OrderBy(u => u.Name)
                    };
                }
                else
                {
                    query = query.OrderBy(u => u.Name);
                }

                // Получаем общее количество записей
                var totalCount = await query.CountAsync(cancellationToken);

                // Применяем пагинацию
                var items = await query
                    .Skip((request.Page - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToListAsync(cancellationToken);

                return new PaginatedResponse<User>(null,items, totalCount, request.Page, request.PageSize);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка получения пользователей с пагинацией");
                throw;
            }
        }

        /// <summary>
        /// Получение активных пользователей (были активны в последние N минут)
        /// </summary>
        public async Task<List<UserInfoDto>> GetActiveUsersAsync(int minutes = 5, CancellationToken cancellationToken = default)
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-minutes);
            var users = await _context.Users
                .Where(u => u.IsOnline && u.LastSeen > cutoff && u.Status != "banned")
                .ToListAsync(cancellationToken);
            return users.ToUserInfoDtos();
        }

        /// <summary>
        /// Поиск пользователей по имени или ID
        /// </summary>
        public async Task<List<UserInfoDto>> SearchUsersAsync(string query, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return new List<UserInfoDto>();
            }

            query = query.ToLower();
            var users = await _context.Users
                .Where(u => u.Name.ToLower().Contains(query) || 
                            u.UserId.ToLower().Contains(query) ||
                            (u.Email != null && u.Email.ToLower().Contains(query)))
                .Take(50)
                .ToListAsync(cancellationToken);
            return users.ToUserInfoDtos();
        }

        /// <summary>
        /// Получение пользователей по статусу с пагинацией
        /// Получение списка всех пользователей с фильтрацией по статусу
        /// </summary>
        public async Task<UsersListDto> GetUsersByStatusAsync(
            string statusFilter = null, 
            int page = 1, 
            int pageSize = 50,
            CancellationToken cancellationToken = default)
        {
            var query = _context.Users.AsQueryable();

            // Применяем фильтр по статусу если указан
            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(u => u.Status == statusFilter);
            }

            // Получаем общее количество пользователей для пагинации
            var total = await query.CountAsync(cancellationToken);

            // Пагинация
            var users = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new UsersListDto
            {
                Users = users.ToUserInfoDtos(),
                Total = total,
                Online = statusFilter == "online" ? total :
                    statusFilter == null ? await _context.Users.CountAsync(u => u.Status == "online", cancellationToken) : 0
            };
        }

/* УДАЛЕНО в 5.1
        /// <summary>
        /// Проверка наличия у пользователя требуемой роли
        /// </summary>
        public async Task<bool> HasRoleAsync(string userId, string requiredRole)
        {
            var user = await GetUserModelAsync(userId);
            if (user == null) return false;

            return Roles.GetPriority(user.Role) >= Roles.GetPriority(requiredRole);
        }

        /// <summary>
        /// Проверка, является ли пользователь администратором
        /// </summary>
        public async Task<bool> IsAdminAsync(string userId)
        {
            return await HasRoleAsync(userId, Roles.Admin);
        }

        /// <summary>
        /// Проверка, является ли пользователь модератором (или выше)
        /// </summary>
        public async Task<bool> IsModeratorAsync(string userId)
        {
            return await HasRoleAsync(userId, Roles.Manager);
        }
*/

        // ===== ОБНОВЛЕНИЕ СТАТУСА =====

        /// <summary>
        /// Обновление статуса пользователя
        /// </summary>
        public async Task UpdateUserStatusAsync(
            string userId, 
            bool isOnline, 
            string status = null,
            CancellationToken cancellationToken = default)
        {
            //var user = await GetUserModelAsync(userId);
            var user = await GetUserEntityAsync(userId, cancellationToken);            
            if (user == null) return;

            user.IsOnline = isOnline;
            user.LastSeen = DateTime.UtcNow;
            if (!string.IsNullOrEmpty(status))
            {
                user.Status = status;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        // ===== ЛОГИРОВАНИЕ =====

        /// <summary>
        /// Запись действия модерации в лог
        /// </summary>
        public async Task LogModerationAsync(
            string moderatorId,
            string targetUserId,
            string action,
            string reason = null,
            int durationMinutes = 0,
            CancellationToken cancellationToken = default)
        {
            var log = new ModerationLog
            {
                LogId = Guid.NewGuid().ToString(),
                ModeratorId = moderatorId,
                TargetUserId = targetUserId,
                Action = action,
                Reason = reason,
                Timestamp = DateTime.UtcNow,
                DurationMinutes = durationMinutes
            };

            await _context.ModerationLogs.AddAsync(log, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        /// <summary>
        /// Получение логов модерации
        /// </summary>
        public async Task<List<ModerationLog>> GetModerationLogsAsync(
            string userId = null, 
            int limit = 100,
            CancellationToken cancellationToken = default)
        {
            var query = _context.ModerationLogs
                .Include(l => l.Moderator)
                .Include(l => l.TargetUser)
                .OrderByDescending(l => l.Timestamp)
                //.Take(limit);
                .Take(limit) as IQueryable<ModerationLog>;

            if (!string.IsNullOrEmpty(userId))
            {
                query = query.Where(l =>                 
                    l.ModeratorId == userId || l.TargetUserId == userId);
            }

            return await query.ToListAsync(cancellationToken);
        }

        // ===== МОДЕРАЦИЯ (БАН, МУТ, КИК) =====

        /// <summary>
        /// Блокировка пользователя (бан) с транзакцией
        /// </summary>
        public async Task<bool> BanUserAsync(
            string userId, 
            string moderatorId, 
            string reason,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            
            try
            {
                //var user = await GetUserModelAsync(userId);
                var user = await GetUserEntityAsync(userId, cancellationToken);                
                if (user == null) return false;

                // Нельзя забанить администратора
                if (user.Role == Roles.Admin)
                {
                    return false;
                }

                user.Status = "banned";
                user.BanReason = reason;
                user.BannedAt = DateTime.UtcNow;
                user.IsOnline = false;

                // Деактивируем все комнаты пользователя
                var userRooms = await _context.UserRooms
                    .Where(ur => ur.UserId == userId && ur.IsActive)
                    .ToListAsync(cancellationToken);

                foreach (var ur in userRooms)
                {
                    ur.IsActive = false;
                    ur.LastActivity = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync(cancellationToken);

                // Логируем действие
                await LogModerationAsync(moderatorId, userId, "ban", reason, 0, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogWarning($"Пользователь {userId} забанен модератором {moderatorId}");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка при бане пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Разблокировка пользователя  с транзакцией
        /// </summary>
        public async Task<bool> UnbanUserAsync(
            string userId, 
            string moderatorId,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                //var user = await GetUserModelAsync(userId);
                var user = await GetUserEntityAsync(userId, cancellationToken);
                if (user == null) return false;

                user.Status = "offline";
                user.BanReason = null;
                user.BannedAt = null;

                await _context.SaveChangesAsync(cancellationToken);
                await LogModerationAsync(moderatorId, userId, "unban", null, 0, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation($"Пользователь {userId} разбанен модератором {moderatorId}");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка при разбане пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Заглушка пользователя (mute) с транзакцией
        /// </summary>
        public async Task<bool> MuteUserAsync(
            string userId, 
            int minutes, 
            string moderatorId, 
            string reason,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                //var user = await GetUserModelAsync(userId);
                var user = await GetUserEntityAsync(userId, cancellationToken);
                if (user == null) return false;

                // Нельзя заглушить администратора
                if (user.Role == Roles.Admin)
                {
                    return false;
                }

                user.MutedUntil = DateTime.UtcNow.AddMinutes(minutes);

                await _context.SaveChangesAsync(cancellationToken);

                await LogModerationAsync(moderatorId, userId, "mute", reason, minutes, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation($"Пользователь {userId} заглушен на {minutes} минут");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка при муте пользователя {userId}");
                throw;
            }
        }

        /// <summary>
        /// Кик пользователя из комнаты (kick) с транзакцией
        /// </summary>
        public async Task<bool> KickUserAsync(
            string userId, 
            string roomId, 
            string moderatorId = null,
            CancellationToken cancellationToken = default)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                var user = await _context.Users
                    .Include(u => u.UserRooms)
                    .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);
                if (user == null) return false;

                // Нельзя кикнуть администратора
                if (user.Role == Roles.Admin)
                {
                    return false;
                }

                var userRoom = user.UserRooms?.FirstOrDefault(ur => ur.RoomId == roomId);
                if (userRoom != null)
                {
                    userRoom.IsActive = false;
                    userRoom.LastActivity = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync(cancellationToken);

                await LogModerationAsync(moderatorId, userId, "kick", null, 0, cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation($"Пользователь {userId} кикнут из комнаты {roomId}");
                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, $"Ошибка при кике пользователя {userId}");
                throw;
            }
        }

        // ===== СТАТИСТИКА =====

        /// <summary>
        /// Получение статистики пользователей
        /// </summary>
        public async Task<object> GetUserStatsAsync(CancellationToken cancellationToken = default)
        {
            var totalUsers = await _context.Users.CountAsync(cancellationToken);
            var onlineUsers = await _context.Users.CountAsync(u => u.IsOnline, cancellationToken);
            var bannedUsers = await _context.Users.CountAsync(u => u.Status == "banned", cancellationToken);

            var roleStats = new Dictionary<string, int>();
            foreach (var role in Roles.AllRoles)
            {
                var count = await _context.Users.CountAsync(u => u.Role == role, cancellationToken);
                roleStats[role] = count;
            }

            return new
            {
                TotalUsers = totalUsers,
                OnlineUsers = onlineUsers,
                BannedUsers = bannedUsers,
                Roles = roleStats
            };
        }
    }
}