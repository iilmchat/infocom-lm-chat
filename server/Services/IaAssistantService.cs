using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ProjectManager.API.DTOs;
using ProjectManager.API.Helpers;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса для ИИ-ассистентов.
    /// </summary>
    public class IaAssistantService : IIaAssistantService
    {
        private readonly IProjectService _projectService;
        private readonly IAuditService _auditService;
        private readonly ILogger<IaAssistantService> _logger;
        private readonly ProjectStorageSettings _storageSettings;

        public IaAssistantService(
            IProjectService projectService,
            IAuditService auditService,
            ILogger<IaAssistantService> logger,
            IOptions<ProjectStorageSettings> storageOptions)
        {
            _projectService = projectService;
            _auditService = auditService;
            _logger = logger;
            _storageSettings = storageOptions.Value;
        }

        /// <summary>
        /// Проверяет доступ и статус проекта.
        /// </summary>
        private async Task EnsureProjectAccessAndNotClosedAsync(int projectId, int currentUserId, bool isAdmin)
        {
            var project = await _projectService.GetProjectByIdAsync(projectId, currentUserId, isAdmin);
            if (project.Status == ProjectStatus.Closed)
                throw new InvalidOperationException("Нельзя изменять закрытый проект.");
        }

        public async Task<RunBatResponse> RunBatAsync(int projectId, int currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAndNotClosedAsync(projectId, currentUserId, isAdmin);

            // Получаем корневую папку проекта
            var rootPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!Directory.Exists(rootPath))
                Directory.CreateDirectory(rootPath);

            var scriptFullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, _storageSettings.ScriptPath);
            if (!File.Exists(scriptFullPath))
                throw new FileNotFoundException($"Скрипт не найден: {scriptFullPath}");

            // Запускаем .bat
            var startInfo = new ProcessStartInfo
            {
                FileName = scriptFullPath,
                WorkingDirectory = rootPath,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            using var process = new Process { StartInfo = startInfo };
            var output = new StringBuilder();
            var error = new StringBuilder();

            process.OutputDataReceived += (sender, e) => output.AppendLine(e.Data);
            process.ErrorDataReceived += (sender, e) => error.AppendLine(e.Data);

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            if (!process.WaitForExit(60000)) // 60 секунд
            {
                process.Kill();
                throw new TimeoutException("Скрипт не завершился за 60 секунд.");
            }

            await process.WaitForExitAsync(cancellationToken);

            var log = output.ToString();
            if (!string.IsNullOrEmpty(error.ToString()))
                log += "\n[STDERR]\n" + error.ToString();

            // Логируем действие
            await _auditService.LogAsync(currentUserId, "RunBat", "Project", projectId, new { ScriptPath = scriptFullPath });

            return new RunBatResponse { Log = log };
        }

        /// <summary>
        /// Сохраняет файл в проекте по относительному пути, проверяя содержимое.
        /// </summary>
        /// <param name="projectId">Идентификатор проекта.</param>
        /// <param name="currentUserId">Идентификатор текущего пользователя.</param>
        /// <param name="isAdmin">Признак администратора.</param>
        /// <param name="path">Относительный путь файла.</param>
        /// <param name="content">Содержимое файла.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Ответ с идентификатором файла.</returns>
        public async Task<SaveCodeResponse> SaveCodeAsync(int projectId, int currentUserId, bool isAdmin, string path, string content, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAndNotClosedAsync(projectId, currentUserId, isAdmin);

            // Максимальный размер файла – 5 МБ (можно настроить)
            const int maxFileSizeBytes = 5 * 1024 * 1024;

            if (string.IsNullOrEmpty(content))
                throw new ArgumentException("Содержимое файла не может быть пустым.");

            var byteCount = System.Text.Encoding.UTF8.GetByteCount(content);
            if (byteCount > maxFileSizeBytes)
                throw new InvalidOperationException($"Превышен максимальный размер файла ({maxFileSizeBytes} байт).");

            // Проверка на бинарные данные
            foreach (char c in content)
            {
                if (c == '\0' || (char.IsControl(c) && c != '\r' && c != '\n' && c != '\t'))
                    throw new InvalidOperationException("Обнаружены бинарные данные в содержимом файла.");
            }

            var rootPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!PathHelper.TryGetSafeFullPath(rootPath, path, out var fullPath))
                throw new ArgumentException("Некорректный путь к файлу.");

            PathHelper.EnsureDirectoryExists(fullPath);
            await File.WriteAllTextAsync(fullPath, content, new UTF8Encoding(false), cancellationToken);

            await _auditService.LogAsync(currentUserId, "SaveCode", "Project", projectId, new { Path = path });
            return new SaveCodeResponse { FileId = path };
        }

        public async Task<CommitResponse> CommitAsync(int projectId, int currentUserId, bool isAdmin, string message, CancellationToken cancellationToken = default)
        {
            await EnsureProjectAccessAndNotClosedAsync(projectId, currentUserId, isAdmin);

            var repoPath = Path.Combine(_storageSettings.RootPath, projectId.ToString());
            if (!Directory.Exists(repoPath))
                Directory.CreateDirectory(repoPath);

            var gitPath = _storageSettings.GitExecutablePath ?? "git";

            // Проверяем, установлен ли Git
            if (!await GitProcessHelper.IsGitInstalledAsync(gitPath))
                throw new InvalidOperationException("Git не установлен или не доступен.");

            // Инициализируем репозиторий, если нет .git
            var gitDir = Path.Combine(repoPath, ".git");
            if (!Directory.Exists(gitDir))
            {
                await GitProcessHelper.InitRepositoryAsync(repoPath, gitPath);
            }

            // Получаем данные текущего пользователя (из токена или фиктивные)
            var userName = $"User{currentUserId}";
            var userEmail = $"{currentUserId}@projectmanager.local";
            // В реальном проекте нужно извлекать имя/email из токена или БД

            // Выполняем add + commit
            var hash = await GitProcessHelper.AddAndCommitAsync(repoPath, message, userName, userEmail, gitPath);

            // Логируем
            await _auditService.LogAsync(currentUserId, "Commit", "Project", projectId, new { Message = message, Hash = hash });

            return new CommitResponse { CommitHash = hash };
        }
    }
}