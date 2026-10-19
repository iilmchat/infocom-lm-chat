namespace ProjectManager.API.Models
{
    /// <summary>
    /// Статус задачи разработчика.
    /// </summary>
    public enum DeveloperTaskStatus
    {
        /// <summary>Ожидает выполнения.</summary>
        Pending = 0,

        /// <summary>Выполняется в данный момент.</summary>
        InProgress = 1,

        /// <summary>Завершена (ожидает подтверждения владельца).</summary>
        Completed = 2,

        /// <summary>Подтверждена владельцем.</summary>
        Approved = 3,

        /// <summary>Отклонена владельцем (требует доработки).</summary>
        Rejected = 4
    }
}