using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация постобработки по умолчанию: удаление маркеров кода, лишних пробелов.
    /// </summary>
    public class DefaultOutputPostProcessor : IOutputPostProcessor
    {
        /// <inheritdoc/>
        public string PostProcess(string content)
        {
            if (string.IsNullOrEmpty(content))
                return content;

            // Удаляем обёртки ```...``` вокруг кода
            var trimmed = content.Trim();
            if (trimmed.StartsWith("```") && trimmed.EndsWith("```"))
            {
                var firstNewLine = trimmed.IndexOf('\n');
                if (firstNewLine >= 0)
                {
                    trimmed = trimmed.Substring(firstNewLine + 1);
                    var lastBackticks = trimmed.LastIndexOf("```");
                    if (lastBackticks >= 0)
                        trimmed = trimmed.Substring(0, lastBackticks);
                }
            }

            // Убираем лишние пробелы в начале и конце
            return trimmed.Trim();
        }
    }
}