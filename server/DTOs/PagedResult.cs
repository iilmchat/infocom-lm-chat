using System.Collections.Generic;

namespace ProjectManager.API.DTOs
{
    /// <summary>
    /// Универсальный контейнер для результатов с пагинацией (добавлен в версии 1.2)
    /// </summary>
    public class PagedResult<T>
    {
        public List<T> Items { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages => (TotalCount + PageSize - 1) / PageSize;
    }
}