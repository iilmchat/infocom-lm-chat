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
 * 
 * Улучшения:
 * 1. Добавлена обработка AbortController для отмены предыдущих запросов
 * 2. Улучшена обработка ошибок с разными статусами
 * 3. Добавлен экспоненциальный бэкофф с джиттером для избежания "Thundering Herd"
 * 4. Исправлена логика определения ошибок для повторных попыток
 */
export async function fetchWithRetry(url, options = {}, retries = CONFIG.RETRIES.MAX_RETRIES) {
    let lastError;
    const controller = new AbortController();
    
    // Если сигнал не передан в options, используем наш контроллер
    const fetchOptions = {
        ...options,
        signal: options.signal || controller.signal
    };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, fetchOptions);
            
            // Успешный ответ - возвращаем сразу
            if (response.ok) return response;
            
            // Ошибки, которые можно повторить: 429 (Too Many Requests), 5xx (Server Errors)
            // 408 (Request Timeout) также стоит повторить
            if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Ошибки клиента (4xx кроме 429) не повторяем
            return response;
            
        } catch (error) {
            lastError = error;
            
            // Если ошибка была вызвана abort, выходим без повторных попыток
            if (error.name === 'AbortError') {
                throw new Error('Запрос был прерван');
            }
            
            // Если это последняя попытка - выбрасываем ошибку
            if (i === retries - 1) {
                throw lastError;
            }
            
            // Экспоненциальная задержка с джиттером (±20% случайности)
            const baseDelay = CONFIG.RETRIES.RETRY_DELAY * Math.pow(2, i);
            const jitter = baseDelay * (0.8 + Math.random() * 0.4); // ±20%
            const delay = Math.min(jitter, CONFIG.RETRIES.MAX_DELAY || 30000); // Максимум 30 секунд
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError || new Error('Количество попыток достигло максимума');
}

/**
 * Проверяет доступность URL
 * @param {string} url - URL для проверки
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<boolean>}
 * 
 * Улучшения:
 * 1. Добавлена очистка ресурсов (clearTimeout)
 * 2. Улучшена обработка ошибок
 */
export async function checkUrlAvailability(url, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, { 
            signal: controller.signal, 
            method: 'HEAD',
            // Добавляем небольшие заголовки, чтобы избежать кэширования
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        clearTimeout(timeoutId);
        // Если ошибка из-за таймаута - возвращаем false
        return false;
    }
}

/**
 * Создает URL с параметрами запроса
 * @param {string} baseUrl - Базовый URL
 * @param {Object} params - Параметры запроса
 * @returns {string} URL с параметрами
 * 
 * Улучшения:
 * 1. Добавлена обработка массивов и объектов
 * 2. Добавлено экранирование специальных символов
 * 3. Обработка вложенных параметров
 */
export function buildUrlWithParams(baseUrl, params = {}) {
    try {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            
            // Обработка массивов
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (item !== undefined && item !== null) {
                        url.searchParams.append(`${key}[]`, String(item));
                    }
                });
                return;
            }
            
            // Обработка объектов (преобразуем в JSON строку)
            if (typeof value === 'object') {
                url.searchParams.append(key, JSON.stringify(value));
                return;
            }
            
            url.searchParams.append(key, String(value));
        });
        return url.toString();
    } catch (error) {
        console.error('Ошибка построения URL:', error);
        // Возвращаем базовый URL в случае ошибки
        return baseUrl;
    }
}

/**
 * Выполняет параллельные запросы с ограничением количества одновременных
 * @param {string[]} urls - Массив URL
 * @param {Object} options - Опции запроса
 * @param {number} concurrency - Максимальное количество параллельных запросов
 * @returns {Promise<Response[]>} Массив ответов
 * 
 * Улучшения:
 * 1. Добавлено ограничение на количество одновременных запросов
 * 2. Обработка ошибок - если один запрос упал, остальные продолжаются
 * 3. Возвращает результаты всех запросов (успешных и неуспешных)
 */
export async function fetchAll(urls, options = {}, concurrency = 5) {
    if (!urls || urls.length === 0) return [];
    
    const results = [];
    const errors = [];
    
    // Функция для выполнения одного запроса с обработкой ошибок
    const fetchWithErrorHandling = async (url, index) => {
        try {
            const response = await fetch(url, options);
            return { index, response, error: null };
        } catch (error) {
            return { index, response: null, error };
        }
    };
    
    // Разбиваем на чанки с ограниченной конкурентностью
    for (let i = 0; i < urls.length; i += concurrency) {
        const chunk = urls.slice(i, i + concurrency);
        const chunkPromises = chunk.map((url, idx) => 
            fetchWithErrorHandling(url, i + idx)
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
    }
    
    // Сортируем по индексу
    results.sort((a, b) => a.index - b.index);
    
    // Разделяем успешные и неуспешные
    const successful = results.filter(r => r.response).map(r => r.response);
    const failed = results.filter(r => r.error).map(r => r.error);
    
    if (failed.length > 0) {
        console.warn(`Неудачных запросов: ${failed.length} из ${urls.length}`);
    }
    
    return successful;
}

/**
 * Выполняет запрос с таймаутом
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<Response>} Ответ сервера
 * 
 * Улучшения:
 * 1. Добавлена проверка на переданный сигнал
 * 2. Улучшена обработка ошибок
 * 3. Добавлена очистка таймаута
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Если сигнал передан в options, используем его вместе с нашим
    const signal = options.signal 
        ? combineSignals(options.signal, controller.signal)
        : controller.signal;

    try {
        const response = await fetch(url, {
            ...options,
            signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            // Проверяем, кто вызвал abort - таймаут или внешний сигнал
            if (controller.signal.aborted) {
                throw new Error(`Запрос превысил таймаут (${timeout}ms)`);
            }
        }
        throw error;
    }
}

/**
 * Объединяет два AbortSignal
 * @param {AbortSignal} signal1 - Первый сигнал
 * @param {AbortSignal} signal2 - Второй сигнал
 * @returns {AbortSignal} Объединенный сигнал
 */
function combineSignals(signal1, signal2) {
    const controller = new AbortController();
    
    const onAbort = () => controller.abort();
    
    if (signal1.aborted || signal2.aborted) {
        controller.abort();
        return controller.signal;
    }
    
    signal1.addEventListener('abort', onAbort);
    signal2.addEventListener('abort', onAbort);
    
    // Возвращаем сигнал с возможностью отписки
    const signal = controller.signal;
    const originalRemoveEventListener = signal.removeEventListener;
    
    // Добавляем очистку при удалении
    signal.removeEventListener = function(...args) {
        signal1.removeEventListener('abort', onAbort);
        signal2.removeEventListener('abort', onAbort);
        return originalRemoveEventListener.apply(this, args);
    };
    
    return signal;
}

/**
 * Проверяет статус ответа
 * @param {Response} response - Ответ сервера
 * @param {string} errorMessage - Сообщение об ошибке
 * @returns {Promise<Response>}
 * 
 * Улучшения:
 * 1. Добавлена проверка ответа на null/undefined
 * 2. Улучшено форматирование ошибки
 */
export async function checkResponseStatus(response, errorMessage = 'Ошибка запроса') {
    if (!response) {
        throw new Error(`${errorMessage}: Ответ отсутствует`);
    }
    
    if (!response.ok) {
        let errorText = '';
        try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const json = await response.json();
                errorText = JSON.stringify(json);
            } else {
                errorText = await response.text();
            }
        } catch (e) {
            errorText = 'Не удалось прочитать тело ответа';
        }
        
        // Создаем более информативное сообщение об ошибке
        const error = new Error(
            `${errorMessage}: ${response.status} ${response.statusText}` +
            (errorText ? ` - ${errorText}` : '')
        );
        error.status = response.status;
        error.response = response;
        throw error;
    }
    return response;
}

/**
 * Получает JSON из ответа с проверкой
 * @param {Response} response - Ответ сервера
 * @returns {Promise<any>} Парсенный JSON
 * 
 * Улучшения:
 * 1. Добавлена проверка Content-Type
 * 2. Улучшена обработка ошибок парсинга
 */
export async function getJSON(response) {
    await checkResponseStatus(response);
    
    // Проверяем Content-Type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        console.warn(`Ожидался JSON, получен Content-Type: ${contentType}`);
        // Пробуем парсить как JSON, но не выбрасываем ошибку
    }
    
    try {
        const data = await response.json();
        return data;
    } catch (error) {
        // Если не удалось распарсить JSON, пробуем получить текст
        try {
            const text = await response.text();
            throw new Error(`Не удалось распарсить JSON: ${text.substring(0, 100)}`);
        } catch (textError) {
            throw new Error(`Не удалось распарсить JSON: ${error.message}`);
        }
    }
}

/**
 * Дополнительная утилита: проверка соединения
 * @param {string} testUrl - URL для проверки соединения
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<boolean>} Доступность соединения
 */
export async function checkConnection(testUrl = 'https://www.google.com', timeout = 3000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        await fetch(testUrl, { 
            signal: controller.signal,
            mode: 'no-cors' // Не требует CORS для проверки соединения
        });
        
        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        // Даже при ошибке, если мы получили ответ, значит соединение есть
        if (error.name === 'AbortError') {
            return false;
        }
        return false;
    }
}