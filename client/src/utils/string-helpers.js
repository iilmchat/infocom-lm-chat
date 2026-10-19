// src/utils/string-helpers.js

/**
 * Утилиты для работы со строками
 */

/**
 * Обрезает текст до указанной длины
 * @param {string} text - Текст
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс (по умолчанию '...')
 * @returns {string} Обрезанный текст
 */
export function truncateText(text, maxLength, suffix = '...') {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + suffix;
}

/**
 * Обрезает текст по словам
 * @param {string} text - Текст
 * @param {number} maxLength - Максимальная длина
 * @param {string} suffix - Суффикс (по умолчанию '...')
 * @returns {string} Обрезанный текст
 */
export function truncateTextByWords(text, maxLength, suffix = '...') {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + suffix;
}

/**
 * Преобразует текст в заголовок
 * @param {string} text - Текст
 * @returns {string} Текст с заглавной буквы
 */
export function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Преобразует текст в URL-friendly строку
 * @param {string} text - Текст
 * @returns {string} URL-friendly строка
 */
export function slugify(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Экранирует HTML символы
 * @param {string} text - Текст
 * @returns {string} Экранированный текст
 */
export function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'/*,
        "'": '&#039;'*/
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Проверяет, является ли строка валидным JSON
 * @param {string} text - Текст
 * @returns {boolean}
 */
export function isValidJSON(text) {
    try {
        JSON.parse(text);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Извлекает все ссылки из текста
 * @param {string} text - Текст
 * @returns {string[]} Массив ссылок
 */
export function extractUrls(text) {
    if (!text) return [];
    const regex = /https?:\/\/[^\s]+/g;
    return text.match(regex) || [];
}

/**
 * Считает количество слов в тексте
 * @param {string} text - Текст
 * @returns {number} Количество слов
 */
export function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
}

/**
 * Считает количество символов без пробелов
 * @param {string} text - Текст
 * @returns {number} Количество символов без пробелов
 */
export function countCharsWithoutSpaces(text) {
    if (!text) return 0;
    return text.replace(/\s/g, '').length;
}

/**
 * Проверяет, содержит ли строка код
 * @param {string} text - Текст
 * @returns {boolean}
 */
export function containsCode(text) {
    if (!text) return false;
    const patterns = [
        /```[\s\S]*?```/,
        /function\s+\w+\s*\([^)]*\)\s*\{/,
        /def\s+\w+\s*\([^)]*\)\s*:/,
        /class\s+\w+\s*\{/,
        /const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|function)/
    ];
    return patterns.some(pattern => pattern.test(text));
}

/**
 * Глубоко сравнивает два значения на равенство
 * @param {*} a - Первое значение для сравнения
 * @param {*} b - Второе значение для сравнения
 * @returns {boolean} true, если значения равны, иначе false
 */
export function deepEqual(a, b) {
    // Если оба значения одинаковы (по ссылке или по значению)
    if (a === b) {
        return true;
    }

    // Если одно из значений null или undefined, а другое нет - они не равны
    if (a == null || b == null) {
        return a === b;
    }

    // Если типы разных - они не могут быть равны
    if (typeof a !== typeof b) {
        return false;
    }

    // Обработка примитивных типов (string, number, boolean, symbol, bigint)
    if (typeof a !== 'object') {
        return a === b;
    }

    // Если оба значения - null или undefined
    if (a === null && b === null) {
        return true;
    }

    // Проверяем, являются ли оба значения массивами
    const isArrayA = Array.isArray(a);
    const isArrayB = Array.isArray(b);

    // Если один массив, а другой не массив - они не равны
    if (isArrayA !== isArrayB) {
        return false;
    }

    // Если оба значения - объекты или массивы
    // Получаем ключи для сравнения
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Если количество ключей разное - они не равны
    if (keysA.length !== keysB.length) {
        return false;
    }

    // Рекурсивно сравниваем каждое свойство
    for (let key of keysA) {
        // Проверяем, есть ли такой же ключ у второго объекта
        if (!keysB.includes(key)) {
            return false;
        }
        
        // Рекурсивный вызов для сравнения значений свойств
        if (!deepEqual(a[key], b[key])) {
            return false;
        }
    }

    // Все проверки пройдены - объекты равны
    return true;
}