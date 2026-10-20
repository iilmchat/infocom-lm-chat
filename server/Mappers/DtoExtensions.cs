// Mappers/DtoExtensions.cs
using System.Collections.Generic;
using System.Linq;

namespace InfocomChat.Server.Mappers
{
    /// <summary>
    /// Вспомогательные методы для работы с коллекциями DTO
    /// </summary>
    public static class DtoExtensions
    {
        /// <summary>
        /// Преобразует список сущностей в список DTO с использованием маппера
        /// </summary>
        public static List<TDto> ToDtoList<TEntity, TDto>(
            this IEnumerable<TEntity> entities,
            System.Func<TEntity, TDto> mapper)
        {
            return entities?.Select(mapper).ToList() ?? new List<TDto>();
        }
    }
}