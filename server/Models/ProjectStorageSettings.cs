using System;

namespace ProjectManager.API.Models
{
    /// <summary>
    /// Настройки хранения проектов и работы с Git.
    /// </summary>
    public class ProjectStorageSettings
    {
        /// <summary>Корневая папка, где хранятся проекты.</summary>
        public string RootPath { get; set; }

        /// <summary>Путь к .bat-скрипту для создания структуры (относительно корня приложения).</summary>
        public string ScriptPath { get; set; }

        /// <summary>Путь к исполняемому файлу Git (обычно "git").</summary>
        public string GitExecutablePath { get; set; }
    }
}