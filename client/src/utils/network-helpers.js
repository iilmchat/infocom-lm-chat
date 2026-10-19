// src/utils/network-helpers.js
import { CONFIG } from '../config.js';

/**
 * Утилиты для работы с сетью
 * Поддержка старых браузеров через полифиллы AbortController
 */

// Полифилл для AbortController в старых браузерах
// Проверяем поддержку и создаем полифилл при необходимости
const createAbortController = () => {
    if (typeof AbortController !== 'undefined') {
        return new AbortController();
    }
    
    // Полифилл для старых браузеров
    class AbortControllerPolyfill {
        constructor() {
            this.signal = {
                aborted: false,
                _listeners: [],
                addEventListener: function(type, listener) {
                    if (type === 'abort') {
                        this._listeners.push(listener);
                    }
                },
                removeEventListener: function(type, listener) {
                    if (type === 'abort') {
                        this._listeners = this._listeners.filter(l => l !== listener);
                    }
                }
            };
            this._abortListeners = [];
        }
        
        abort() {
            if (this.signal.aborted) return;
            this.signal.aborted = true;
            this.signal._listeners.forEach(listener => {
                try {
                    listener({ type: 'abort', target: this.signal });
                } catch (e) {
                    console.error('Ошибка в обработчике abort:', e);
                }
            });
        }
    }
    
    return new AbortControllerPolyfill();
};

// Проверка поддержки AbortSignal
const isAbortControllerSupported = () => {
    try {
        return typeof AbortController !== 'undefined' && 
               typeof AbortController.prototype.abort === 'function';
    } catch (e) {
        return false;
    }
};

const SUPPORTS_ABORT = isAbortControllerSupported();

/**
 * Безопасное создание сигнала с учетом совместимости
 * @param {AbortSignal} externalSignal - Внешний сигнал (может быть undefined)
 * @returns {Object} Объект с сигналом и контроллером
 */
function createSafeSignal(externalSignal) {
    let controller = null;
    let signal = null;
    
    if (SUPPORTS_ABORT) {
        // Современные браузеры
        controller = new AbortController();
        
        if (externalSignal && typeof externalSignal === 'object') {
            // Если передан внешний сигнал, объединяем их
            // В старых браузерах просто используем внешний сигнал
            try {
                // Проверяем, что externalSignal имеет метод addEventListener
                if (typeof externalSignal.addEventListener === 'function') {
                    // Объединяем сигналы
                    const combined = {
                        aborted: false,
                        _external: externalSignal,
                        _internal: controller.signal,
                        _listeners: [],
                        addEventListener: function(type, listener) {
                            if (type === 'abort') {
                                this._listeners.push(listener);
                            }
                        },
                        removeEventListener: function(type, listener) {
                            if (type === 'abort') {
                                this._listeners = this._listeners.filter(l => l !== listener);
                            }
                        }
                    };
                    
                    // При abort любого сигнала - вызываем все обработчики
                    const abortHandler = () => {
                        if (combined.aborted) return;
                        combined.aborted = true;
                        combined._listeners.forEach(listener => {
                            try {
                                listener({ type: 'abort', target: combined });
                            } catch (e) {
                                console.error('Ошибка в обработчике abort:', e);
                            }
                        });
                    };
                    
                    // Подписываемся на оба сигнала
                    if (externalSignal.aborted) {
                        abortHandler();
                    } else {
                        externalSignal.addEventListener('abort', abortHandler);
                        controller.signal.addEventListener('abort', abortHandler);
                    }
                    
                    signal = combined;
                    return { controller, signal };
                }
            } catch (e) {
                console.warn('Ошибка при объединении сигналов, используем только внутренний:', e);
            }
        }
        
        // Используем только внутренний сигнал
        signal = controller.signal;
        return { controller, signal };
    }
    
    // Старые браузеры без AbortController
    // Возвращаем заглушку, которая эмулирует поведение
    const abortControllerPolyfill = {
        signal: {
            aborted: false,
            _listeners: [],
            addEventListener: function(type, listener) {
                if (type === 'abort') {
                    this._listeners.push(listener);
                }
            },
            removeEventListener: function(type, listener) {
                if (type === 'abort') {
                    this._listeners = this._listeners.filter(l => l !== listener);
                }
            }
        },
        abort: function() {
            if (this.signal.aborted) return;
            this.signal.aborted = true;
            this.signal._listeners.forEach(listener => {
                try {
                    listener({ type: 'abort', target: this.signal });
                } catch (e) {
                    console.error('Ошибка в обработчике abort:', e);
                }
            });
        }
    };
    
    return { controller: abortControllerPolyfill, signal: abortControllerPolyfill.signal };
}

/**
 * Выполняет запрос с повторными попытками
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса (fetch)
 * @param {number} retries - Количество попыток
 * @returns {Promise<Response>} Ответ сервера
 */
export async function fetchWithRetry(url, options = {}, retries = CONFIG.RETRIES.MAX_RETRIES) {
    let lastError;
    const { controller, signal } = createSafeSignal(options.signal);
    
    // Создаем опции для fetch без signal, если он не поддерживается
    const fetchOptions = { ...options };
    
    // Добавляем сигнал только если поддерживается и если это не внешний сигнал
    if (SUPPORTS_ABORT && options.signal) {
        // Если есть внешний сигнал, используем его напрямую (для совместимости)
        fetchOptions.signal = options.signal;
    } else if (SUPPORTS_ABORT && !options.signal) {
        // Если нет внешнего сигнала, используем наш
        fetchOptions.signal = signal;
    }
    // В старых браузерах не добавляем signal вовсе

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, fetchOptions);
            
            if (response.ok) return response;
            
            if ([408, 429, 500, 502, 503, 504].includes(response.status)) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return response;
            
        } catch (error) {
            lastError = error;
            
            // Проверяем на abort (если поддерживается)
            if (error.name === 'AbortError' || 
                (controller && controller.signal && controller.signal.aborted)) {
                throw new Error('Запрос был прерван');
            }
            
            if (i === retries - 1) {
                throw lastError;
            }
            
            // Экспоненциальная задержка с джиттером
            const baseDelay = CONFIG.RETRIES.RETRY_DELAY * Math.pow(2, i);
            const jitter = baseDelay * (0.8 + Math.random() * 0.4);
            const delay = Math.min(jitter, CONFIG.RETRIES.MAX_DELAY || 30000);
            
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
 */
export async function checkUrlAvailability(url, timeout = 5000) {
    let controller = null;
    let timeoutId = null;
    
    try {
        const fetchOptions = {
            method: 'HEAD',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };
        
        // Добавляем поддержку таймаута только если есть AbortController
        if (SUPPORTS_ABORT) {
            controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), timeout);
            fetchOptions.signal = controller.signal;
        }
        
        const response = await fetch(url, fetchOptions);
        
        if (timeoutId) clearTimeout(timeoutId);
        return response.ok;
        
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
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
    try {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            
            if (Array.isArray(value)) {
                value.forEach(item => {
                    if (item !== undefined && item !== null) {
                        url.searchParams.append(`${key}[]`, String(item));
                    }
                });
                return;
            }
            
            if (typeof value === 'object') {
                url.searchParams.append(key, JSON.stringify(value));
                return;
            }
            
            url.searchParams.append(key, String(value));
        });
        return url.toString();
    } catch (error) {
        console.error('Ошибка построения URL:', error);
        return baseUrl;
    }
}

/**
 * Выполняет параллельные запросы с ограничением количества одновременных
 * @param {string[]} urls - Массив URL
 * @param {Object} options - Опции запроса
 * @param {number} concurrency - Максимальное количество параллельных запросов
 * @returns {Promise<Response[]>} Массив ответов
 */
export async function fetchAll(urls, options = {}, concurrency = 5) {
    if (!urls || urls.length === 0) return [];
    
    const results = [];
    
    const fetchWithErrorHandling = async (url, index) => {
        try {
            const response = await fetch(url, options);
            return { index, response, error: null };
        } catch (error) {
            return { index, response: null, error };
        }
    };
    
    for (let i = 0; i < urls.length; i += concurrency) {
        const chunk = urls.slice(i, i + concurrency);
        const chunkPromises = chunk.map((url, idx) => 
            fetchWithErrorHandling(url, i + idx)
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
    }
    
    results.sort((a, b) => a.index - b.index);
    
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
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    // Если AbortController не поддерживается, используем Promise.race для имитации таймаута
    if (!SUPPORTS_ABORT) {
        return new Promise(async (resolve, reject) => {
            let timeoutId = setTimeout(() => {
                reject(new Error(`Запрос превысил таймаут (${timeout}ms)`));
            }, timeout);
            
            try {
                const response = await fetch(url, options);
                clearTimeout(timeoutId);
                resolve(response);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    // Современные браузеры с поддержкой AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Объединяем сигналы если есть внешний
    let signal = controller.signal;
    if (options.signal && typeof options.signal.addEventListener === 'function') {
        // Создаем объединенный сигнал
        const combinedController = new AbortController();
        const onAbort = () => {
            if (!combinedController.signal.aborted) {
                combinedController.abort();
            }
        };
        
        if (options.signal.aborted || controller.signal.aborted) {
            combinedController.abort();
        } else {
            options.signal.addEventListener('abort', onAbort);
            controller.signal.addEventListener('abort', onAbort);
        }
        signal = combinedController.signal;
    }

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
            throw new Error(`Запрос превысил таймаут (${timeout}ms)`);
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
 */
export async function getJSON(response) {
    await checkResponseStatus(response);
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
        console.warn(`Ожидался JSON, получен Content-Type: ${contentType}`);
    }
    
    try {
        const data = await response.json();
        return data;
    } catch (error) {
        try {
            const text = await response.text();
            throw new Error(`Не удалось распарсить JSON: ${text.substring(0, 100)}`);
        } catch (textError) {
            throw new Error(`Не удалось распарсить JSON: ${error.message}`);
        }
    }
}

/**
 * Проверка соединения
 * @param {string} testUrl - URL для проверки соединения
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<boolean>} Доступность соединения
 */
export async function checkConnection(testUrl = 'https://www.google.com', timeout = 3000) {
    try {
        const fetchOptions = {
            mode: 'no-cors'
        };
        
        if (SUPPORTS_ABORT) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            fetchOptions.signal = controller.signal;
            
            await fetch(testUrl, fetchOptions);
            clearTimeout(timeoutId);
        } else {
            // Для старых браузеров используем Promise.race
            await Promise.race([
                fetch(testUrl, fetchOptions),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeout)
                )
            ]);
        }
        return true;
    } catch (error) {
        return false;
    }
}

// Экспортируем утилиты для проверки совместимости
export const browserSupport = {
    abortController: SUPPORTS_ABORT,
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined'
};