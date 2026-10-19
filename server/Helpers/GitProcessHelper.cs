using System;
using System.Diagnostics;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Вспомогательный класс для выполнения Git-команд через командную строку.
    /// </summary>
    public static class GitProcessHelper
    {
        private const int DefaultTimeoutMs = 30000; // 30 секунд

        /// <summary>
        /// Проверяет, установлен ли Git.
        /// </summary>
        /// <param name="gitPath">Путь к исполняемому файлу Git (по умолчанию "git").</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>True, если Git доступен.</returns>
        public static async Task<bool> IsGitInstalledAsync(string gitPath = "git", CancellationToken cancellationToken = default)
        {
            try
            {
                var result = await RunCommandAsync(gitPath, "--version", null, 5000, cancellationToken);
                return result.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Инициализирует Git-репозиторий в указанной папке.
        /// </summary>
        /// <param name="workingDirectory">Рабочая папка.</param>
        /// <param name="gitPath">Путь к Git.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        public static async Task InitRepositoryAsync(string workingDirectory, string gitPath = "git", CancellationToken cancellationToken = default)
        {
            var result = await RunCommandAsync(gitPath, "init", workingDirectory, DefaultTimeoutMs, cancellationToken);
            if (result.ExitCode != 0)
                throw new InvalidOperationException($"Ошибка инициализации репозитория: {result.Error}");
        }

        /// <summary>
        /// Выполняет git add -A и git commit с указанным сообщением.
        /// </summary>
        /// <param name="workingDirectory">Рабочая папка.</param>
        /// <param name="message">Сообщение коммита.</param>
        /// <param name="authorName">Имя автора.</param>
        /// <param name="authorEmail">Email автора.</param>
        /// <param name="gitPath">Путь к Git.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Хэш коммита.</returns>
        public static async Task<string> AddAndCommitAsync(
            string workingDirectory,
            string message,
            string authorName,
            string authorEmail,
            string gitPath = "git",
            CancellationToken cancellationToken = default)
        {
            // git add -A
            var addResult = await RunCommandAsync(gitPath, "add -A", workingDirectory, DefaultTimeoutMs, cancellationToken);
            if (addResult.ExitCode != 0)
                throw new InvalidOperationException($"Ошибка git add: {addResult.Error}");

            // Проверяем, есть ли изменения
            var statusResult = await RunCommandAsync(gitPath, "status --porcelain", workingDirectory, DefaultTimeoutMs, cancellationToken);
            if (string.IsNullOrWhiteSpace(statusResult.Output))
                throw new InvalidOperationException("Нет изменений для коммита.");

            // Формируем аргументы коммита
            var authorArg = $"-c user.name=\"{authorName}\" -c user.email=\"{authorEmail}\"";
            var commitCmd = $"commit -m \"{EscapeArgument(message)}\"";
            var fullArgs = $"{authorArg} {commitCmd}";

            var commitResult = await RunCommandAsync(gitPath, fullArgs, workingDirectory, DefaultTimeoutMs, cancellationToken);
            if (commitResult.ExitCode != 0)
                throw new InvalidOperationException($"Ошибка git commit: {commitResult.Error}");

            // Получаем хэш коммита
            var hashResult = await RunCommandAsync(gitPath, "rev-parse HEAD", workingDirectory, DefaultTimeoutMs, cancellationToken);
            return hashResult.Output?.Trim();
        }

        /// <summary>
        /// Выполняет команду Git с ограничением по времени и поддержкой отмены.
        /// </summary>
        /// <param name="executable">Исполняемый файл.</param>
        /// <param name="arguments">Аргументы команды.</param>
        /// <param name="workingDirectory">Рабочая папка.</param>
        /// <param name="timeoutMs">Таймаут в миллисекундах.</param>
        /// <param name="cancellationToken">Токен отмены.</param>
        /// <returns>Результат выполнения.</returns>
        private static async Task<CommandResult> RunCommandAsync(
            string executable,
            string arguments,
            string workingDirectory,
            int timeoutMs = DefaultTimeoutMs,
            CancellationToken cancellationToken = default)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = executable,
                Arguments = arguments,
                WorkingDirectory = workingDirectory ?? Directory.GetCurrentDirectory(),
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

            try
            {
                if (!process.WaitForExit(timeoutMs))
                {
                    process.Kill();
                    throw new TimeoutException($"Команда Git не завершилась за {timeoutMs} мс.");
                }

                // Дожидаемся завершения асинхронного чтения
                await process.WaitForExitAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                process.Kill();
                throw;
            }

            return new CommandResult
            {
                ExitCode = process.ExitCode,
                Output = output.ToString(),
                Error = error.ToString()
            };
        }

        /// <summary>
        /// Экранирует двойные кавычки в аргументе.
        /// </summary>
        private static string EscapeArgument(string arg)
        {
            return arg.Replace("\"", "\\\"");
        }

        /// <summary>
        /// Результат выполнения команды.
        /// </summary>
        private class CommandResult
        {
            public int ExitCode { get; set; }
            public string Output { get; set; }
            public string Error { get; set; }
        }
    }
}