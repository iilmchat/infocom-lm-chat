using System;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// DTO для системного промта ассистента.
    /// </summary>
    public class AssistantPromptDto
    {
        public int Id { get; set; }
        public string AssistantType { get; set; }
        public string SystemPrompt { get; set; }
        public string UpdatedByUsername { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int UpdatedBy { get; set; }
        public string UpdaterName { get; set; }        
    }

    /*
    public class AssistantPromptDto
    {
        public int Id { get; set; }
        public string AssistantType { get; set; }
        public string SystemPrompt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int UpdatedBy { get; set; }
        public string UpdaterName { get; set; }
    }
    */
    /// <summary>
    /// Запрос на обновление системного промта.
    /// </summary>
    public class UpdateAssistantPromptRequest
    {
        public string SystemPrompt { get; set; }
    }
}