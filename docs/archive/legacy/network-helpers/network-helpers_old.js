// src/utils/network-helpers.js
import { CONFIG } from '../config.js';

/**
 * Утилиты для работы с сетью
 */

/**
 * Выполняет запрос с повторными попытками
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса (fetch)
 * @param {number} retries - Количество попыток
 * @returns {Promise<Response>} Ответ сервера
 */
export async function fetchWithRetry(url, options = {}, retries = CONFIG.RETRIES.MAX_RETRIES) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 429 || response.status >= 500) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        } catch (e) {
            lastError = e;
            if (i < retries - 1) {
                const delay = CONFIG.RETRIES.RETRY_DELAY * Math.pow(2, i);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError || new Error('Количество попыток достигло максимума');
}

/**
 * Проверяет доступность URL
 * @param {string} url - URL для проверки
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<boolean>}
 */
export async function checkUrlAvailability(url, timeout = 5000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { signal: controller.signal, method: 'HEAD' });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Создает URL с параметрами запроса
 * @param {string} baseUrl - Базовый URL
 * @param {Object} params - Параметры запроса
 * @returns {string} URL с параметрами
 */
export function buildUrlWithParams(baseUrl, params = {}) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
    });
    return url.toString();
}

/**
 * Выполняет параллельные запросы
 * @param {string[]} urls - Массив URL
 * @param {Object} options - Опции запроса
 * @returns {Promise<Response[]>} Массив ответов
 */
export async function fetchAll(urls, options = {}) {
    const promises = urls.map(url => fetch(url, options));
    return Promise.all(promises);
}

/**
 * Выполняет запрос с таймаутом
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<Response>} Ответ сервера
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Запрос превысил таймаут');
        }
        throw error;
    }
}

/**
 * Проверяет статус ответа
 * @param {Response} response - Ответ сервера
 * @param {string} errorMessage - Сообщение об ошибке
 * @returns {Promise<Response>}
 */
export async function checkResponseStatus(response, errorMessage = 'Ошибка запроса') {
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`${errorMessage}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
    }
    return response;
}

/**
 * Получает JSON из ответа с проверкой
 * @param {Response} response - Ответ сервера
 * @returns {Promise<any>} Парсенный JSON
 */
export async function getJSON(response) {
    await checkResponseStatus(response);
    return response.json();
}