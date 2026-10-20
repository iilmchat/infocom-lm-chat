// DTOs/PaginationDto.cs
using System;
using System.Collections.Generic;

namespace InfocomChat.Server.DTOs
{
    /// <summary>
    /// Запрос пагинации с фильтрацией и сортировкой
    /// </summary>
    public class PaginatedRequest
    {
        private int _page = 1;
        private int _pageSize = 50;
        private const int MaxPageSize = 200;

        /// <summary>Номер страницы (начиная с 1)</summary>
        public int Page
        {
            get => _page;
            set => _page = value < 1 ? 1 : value;
        }

        /// <summary>Количество записей на странице (макс. 200)</summary>
        public int PageSize
        {
            get => _pageSize;
            set => _pageSize = value < 1 ? 1 : (value > MaxPageSize ? MaxPageSize : value);
        }

        /// <summary>Поле для сортировки (например, "Name", "CreatedAt")</summary>
        public string SortBy { get; set; } = "Name";

        /// <summary>Порядок сортировки: true - по убыванию, false - по возрастанию</summary>
        public bool SortDescending { get; set; } = false;

        /// <summary>Поисковый запрос (необязательно)</summary>
        public string SearchTerm { get; set; }
    }

    /// <summary>
    /// Ответ с пагинированным списком
    /// </summary>
    /// <typeparam name="T">Тип элементов списка</typeparam>
    public class PaginatedResponse<T>
    {
        /// <summary>Элементы на текущей странице</summary>
        public IEnumerable<T> Items { get; set; }
        
        /// <summary>Элементы текущей страницы</summary>
        public List<T> ItemsList { get; set; }

        /// <summary>Общее количество записей</summary>
        public int TotalCount { get; set; }

        /// <summary>Текущий номер страницы</summary>
        public int Page { get; set; }

        /// <summary>Размер страницы</summary>
        public int PageSize { get; set; }

        /// <summary>Общее количество страниц</summary>
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);

        /// <summary>Есть ли предыдущая страница</summary>
        public bool HasPreviousPage => Page > 1;

        /// <summary>Есть ли следующая страница</summary>
        public bool HasNextPage => Page < TotalPages;

        public PaginatedResponse()
        {
            Items = new List<T>();
        }

        public PaginatedResponse(IEnumerable<T> items, List<T> itemsList, int totalCount, int page, int pageSize)
        {
            Items = items;
            ItemsList = itemsList;
            TotalCount = totalCount;
            Page = page;
            PageSize = pageSize;
        }
    }
    
    /// <summary>
    /// Список пользователей с общей статистикой (для админки)
    /// </summary>
    /*
    public class UsersListDto
    {
        /// <summary>Список пользователей</summary>
        public List<UserInfoDto> Users { get; set; }

        /// <summary>Общее количество пользователей</summary>
        public int Total { get; set; }

        /// <summary>Количество онлайн-пользователей</summary>
        public int Online { get; set; }
    }    
    */
}