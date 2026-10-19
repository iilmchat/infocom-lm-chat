namespace ProjectManager.API.Services.Interfaces
{
    /// <summary>
    /// Интерфейс постобработки текстового вывода модели LM Studio перед сохранением.
    /// </summary>
    public interface IOutputPostProcessor
    {
        /// <summary>
        /// Выполняет постобработку контента.
        /// </summary>
        /// <param name="content">Исходный контент.</param>
        /// <returns>Обработанный контент.</returns>
        string PostProcess(string content);
    }
}