// Services/AttachmentService.cs
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using InfocomChat.Server.Database;
using InfocomChat.Server.Models.Entities;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace InfocomChat.Server.Services
{
    public class AttachmentService
    {
        private readonly ChatDbContext _context;
        private readonly ILogger<AttachmentService> _logger;
        private readonly string _uploadPath;

        public AttachmentService(ChatDbContext context, ILogger<AttachmentService> logger)
        {
            _context = context;
            _logger = logger;
            _uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");

            // Создаём директорию, если её нет
            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }

        public async Task<AttachmentUploadResult> UploadFileAsync(IFormFile file, string messageId)
        {
            try
            {
                if (file == null || file.Length == 0)
                    throw new ArgumentException("Файл не выбран или пустой");

                if (file.Length > 10 * 1024 * 1024) // 10MB
                    throw new ArgumentException("Файл слишком большой (макс. 10MB)");

                // Проверка типа файла
                var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", 
                                           "application/pdf", "text/plain", "application/json" };
                
                if (!allowedTypes.Contains(file.ContentType) && 
                    !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) &&
                    !file.FileName.EndsWith(".txt", StringComparison.OrdinalIgnoreCase) &&
                    !file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ArgumentException("Недопустимый тип файла");
                }

                var fileName = $"{Guid.NewGuid():N}_{file.FileName}";
                var filePath = Path.Combine(_uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var attachment = new Attachment
                {
                    AttachmentId = Guid.NewGuid().ToString(),
                    MessageId = messageId,
                    FileName = file.FileName,
                    FilePath = $"/uploads/{fileName}",
                    FileSize = file.Length,
                    MimeType = file.ContentType,
                    MetadataJson = JsonSerializer.Serialize(new
                    {
                        file.FileName,
                        file.ContentType,
                        file.Length,
                        UploadedAt = DateTime.UtcNow
                    })
                };

                await _context.Attachments.AddAsync(attachment);
                await _context.SaveChangesAsync();

                return new AttachmentUploadResult
                {
                    AttachmentId = attachment.AttachmentId,
                    FileName = file.FileName,
                    FileSize = file.Length,
                    MimeType = file.ContentType,
                    Url = attachment.FilePath
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка загрузки файла для сообщения {messageId}");
                throw;
            }
        }

        public async Task<bool> DeleteFileAsync(string attachmentId)
        {
            try
            {
                var attachment = await _context.Attachments
                    .FirstOrDefaultAsync(a => a.AttachmentId == attachmentId);

                if (attachment == null)
                    return false;

                // Удаляем физический файл
                var filePath = Path.Combine(_uploadPath, Path.GetFileName(attachment.FilePath));
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }

                _context.Attachments.Remove(attachment);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка удаления файла {attachmentId}");
                return false;
            }
        }

        public async Task<Attachment> GetAttachmentAsync(string attachmentId)
        {
            return await _context.Attachments
                .FirstOrDefaultAsync(a => a.AttachmentId == attachmentId);
        }

        public async Task<string> GetFileContentAsBase64Async(string attachmentId)
        {
            try
            {
                var attachment = await GetAttachmentAsync(attachmentId);
                if (attachment == null)
                    return null;

                var filePath = Path.Combine(_uploadPath, Path.GetFileName(attachment.FilePath));
                if (!File.Exists(filePath))
                    return null;

                var bytes = await File.ReadAllBytesAsync(filePath);
                return Convert.ToBase64String(bytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Ошибка получения содержимого файла {attachmentId}");
                return null;
            }
        }
    }
}