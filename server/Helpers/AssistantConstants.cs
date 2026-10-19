using System.Collections.Generic;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Константы для ИИ-ассистентов.
    /// </summary>
    public static class AssistantConstants
    {
        /// <summary>Типы документов, создаваемых архитектором.</summary>
        public static readonly string[] ArchitectDocumentTypes = { "ИТ", "СП", "СФС", "ЭР" };

        /// <summary>Соответствие типа документа и имени файла (постфикс).</summary>
        public static readonly Dictionary<string, string> DocumentTypeToFileName = new Dictionary<string, string>
        {
            { "ИТ", "используемые_технологии" },
            { "СП", "структура_проекта" },
            { "СФС", "структура_файловой_системы" },
            { "ЭР", "этапы_разработки" }
        };

        /// <summary>Соответствие типа документа и расширения файла.</summary>
        public static readonly Dictionary<string, string> DocumentTypeToExtension = new Dictionary<string, string>
        {
            { "ИТ", "txt" },
            { "СП", "txt" },
            { "СФС", "bat" },
            { "ЭР", "txt" }
        };

        /// <summary>Определение инструмента create_file для tool calling.</summary>
        public static ToolDefinition CreateFileToolDefinition => new ToolDefinition
        {
            Type = "function",
            Function = new FunctionDefinition
            {
                Name = "create_file",
                Description = "Создаёт файл в проекте. Вызывайте эту функцию для каждого создаваемого артефакта.",
                Parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        path = new
                        {
                            type = "string",
                            description = "Относительный путь к файлу в формате DOCS/<код_проекта>_<тип>_<версия>.расширение. Например: DOCS/project_используемые_технологии_v1.txt"
                        },
                        content = new
                        {
                            type = "string",
                            description = "Содержимое файла (текст или код)."
                        }
                    },
                    required = new[] { "path", "content" }
                }
            }
        };
    }
}