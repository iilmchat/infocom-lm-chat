using System;
using System.IO;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Вспомогательные методы для работы с путями.
    /// </summary>
    public static class PathHelper
    {
        /// <summary>
        /// Проверяет, находится ли указанный относительный путь в пределах корневой директории.
        /// </summary>
        /// <param name="rootPath">Абсолютный путь к корневой папке.</param>
        /// <param name="relativePath">Относительный путь (может содержать ../).</param>
        /// <param name="fullPath">Возвращает полный безопасный путь.</param>
        /// <returns>true, если путь корректен и не выходит за пределы корня.</returns>
        public static bool TryGetSafeFullPath(string rootPath, string relativePath, out string fullPath)
        {
            fullPath = null;
            try
            {
                // Объединяем и получаем полный путь
                var combined = Path.GetFullPath(Path.Combine(rootPath, relativePath));
                var root = Path.GetFullPath(rootPath);

                // Проверяем, что результирующий путь начинается с корневого
                if (!combined.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    return false;

                fullPath = combined;
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Создаёт все недостающие директории для указанного пути.
        /// </summary>
        public static void EnsureDirectoryExists(string filePath)
        {
            var dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);
        }
    }
}