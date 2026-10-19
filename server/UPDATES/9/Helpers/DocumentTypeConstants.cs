namespace ProjectManager.API.Helpers
{
    /// <summary>
    /// Константы для типов документов проекта.
    /// </summary>
    public static class DocumentTypeConstants
    {
        // Существующие типы
        public const string ID = "ИД";
        public const string Project = "Проект";
        public const string TT = "ТТ";
        public const string PiM_PSI = "ПиМ ПСИ";
        public const string CBI = "ЦБИ";

        // Новые типы для архитектора
        public const string IT = "ИТ";           // Используемые технологии
        public const string SP = "СП";           // Структура проекта
        public const string SFS = "СФС";         // Структура файловой системы
        public const string ER = "ЭР";           // Этапы разработки

        // Ошибки для каждого типа
        public const string ERR_IT = "ERR_ИТ";
        public const string ERR_SP = "ERR_СП";
        public const string ERR_SFS = "ERR_СФС";
        public const string ERR_ER = "ERR_ЭР";

        public const string ERR_TT = "ERR_ТТ";
        
        public const string AT = "АТ";
        public const string RISK = "РИСК";
        public const string PI = "ПИ";
        public const string ERR_AT = "ERR_АТ";
        public const string ERR_RISK = "ERR_РИСК";
        public const string ERR_PI = "ERR_ПИ";       

        // Типы документов разработчика
        public const string CODE = "КОД";       // исходный код
        public const string CONFIG = "КОНФ";    // конфигурационные файлы
        public const string DEV_DOC = "ДР";     // документация разработчика

        // Ошибки для разработчика
        public const string ERR_CODE = "ERR_КОД";
        public const string ERR_CONFIG = "ERR_КОНФ";
        public const string ERR_DEV_DOC = "ERR_ДР";
        public const string ERR_DECOMP = "ERR_ДЕКОМП";

        /// <summary>
        /// Возвращает все допустимые типы документов (для валидации).
        /// </summary>
        public static string[] AllTypes => new[]
        {
            ID, Project, TT, PiM_PSI, CBI, IT, SP, SFS, ER,
            AT, RISK, PI,
            CODE, CONFIG, DEV_DOC,
            ERR_IT, ERR_SP, ERR_SFS, ERR_ER, ERR_TT,
            ERR_AT, ERR_RISK, ERR_PI,
            ERR_CODE, ERR_CONFIG, ERR_DEV_DOC, ERR_DECOMP
        };
    }
}