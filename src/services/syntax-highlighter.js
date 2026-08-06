// src/services/syntax-highlighter.js

import { highlightCache } from './syntax-highlighter-cache.js';
import { highlightDebounce } from '../utils/debounce.js';

/**
 * Сервис подсветки синтаксиса с поддержкой Web Worker и кэширования
 */
class SyntaxHighlighterService {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
        this.isWorkerSupported = typeof Worker !== 'undefined';
        this.ready = false;
        this.listeners = [];
        
        this.initWorker();
    }

    /**
     * Инициализация Web Worker
     */
    initWorker() {
        if (!this.isWorkerSupported) {
            console.warn('Web Workers не поддерживаются, используется fallback');
            this.ready = true;
            return;
        }

        try {
            // Создание worker из строки (для совместимости с модулями)
            const workerCode = this.getWorkerCode();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            
            this.worker = new Worker(workerUrl);
            
            this.worker.addEventListener('message', (event) => {
                this.handleWorkerMessage(event);
            });
            
            this.worker.addEventListener('error', (error) => {
                console.error('Worker ошибка:', error);
                this.handleWorkerError(error);
            });
            
            this.ready = true;
            console.log('Web Worker инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации Worker:', error);
            this.ready = true;
        }
    }

    /**
     * Получение кода Worker (встроенный для простоты)
     * В реальном проекте лучше использовать отдельный файл с importScripts
     */
    getWorkerCode() {
        // Здесь должен быть код из syntax-highlighter.worker.js
        // Для краткости я оставлю placeholder
        return `
            // Worker код (должен быть скопирован из syntax-highlighter.worker.js)
            console.log('Worker запущен');
            self.addEventListener('message', (event) => {
                const { id, code, language } = event.data;
                try {
                    // Простая имитация подсветки для примера
                    const result = '<code class="hljs">' + code.replace(/</g, '&lt;') + '</code>';
                    self.postMessage({ id, success: true, result });
                } catch (error) {
                    self.postMessage({ id, success: false, error: error.message });
                }
            });
        `;
    }

    /**
     * Обработка сообщений от Worker
     */
    handleWorkerMessage(event) {
        const { id, success, result, error, language } = event.data;
        
        const request = this.pendingRequests.get(id);
        if (!request) return;
        
        this.pendingRequests.delete(id);
        
        // Сохраняем в кэш при успехе
        if (success && request.code) {
            highlightCache.set(request.code, language || 'text', result);
        }
        
        // Вызываем колбэк
        if (success) {
            request.resolve(result);
        } else {
            request.reject(new Error(error));
        }
    }

    /**
     * Обработка ошибок Worker
     */
    handleWorkerError(error) {
        // Отклоняем все ожидающие запросы
        for (const [id, request] of this.pendingRequests) {
            request.reject(new Error('Worker error: ' + error.message));
            this.pendingRequests.delete(id);
        }
    }

    /**
     * Синхронная подсветка (fallback для worker)
     */
    highlightSync(code, language) {
        // Базовая реализация для fallback
        // В реальном проекте используйте полноценную реализацию
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        return `<code class="hljs language-${language || 'text'}">${escaped}</code>`;
    }

    /**
     * Асинхронная подсветка с использованием Worker или fallback
     */
    async highlight(code, language = null) {
        try {
            // Валидация входных данных
            if (!code || typeof code !== 'string') {
                throw new Error('Неверный код для подсветки');
            }

            // Валидация языка
            const validLanguages = ['javascript', 'python', 'c', 'java', 'csharp', 'sql', 'html', 'css', 'bash', 'go', 'rust', 'php', 'text'];
            if (language && !validLanguages.includes(language)) {
                console.warn(`Неизвестный язык "${language}", используется автоопределение`);
                language = null;
            }

            // Проверка кэша
            const cached = highlightCache.get(code, language);
            if (cached) {
                return cached.result;
            }

            // Если Worker не поддерживается или не готов
            if (!this.isWorkerSupported || !this.ready) {
                const result = this.highlightSync(code, language);
                highlightCache.set(code, language || 'text', result);
                return result;
            }

            // Отправка задачи в Worker
            return new Promise((resolve, reject) => {
                const id = ++this.requestId;
                
                this.pendingRequests.set(id, {
                    resolve,
                    reject,
                    code,
                    timestamp: Date.now()
                });

                try {
                    this.worker.postMessage({
                        id,
                        code,
                        language: language || 'auto'
                    });

                    // Таймаут для предотвращения зависаний
                    setTimeout(() => {
                        if (this.pendingRequests.has(id)) {
                            this.pendingRequests.delete(id);
                            reject(new Error('Timeout при подсветке кода'));
                        }
                    }, 5000);
                } catch (error) {
                    this.pendingRequests.delete(id);
                    reject(error);
                }
            });
        } catch (error) {
            console.error('Ошибка подсветки:', error);
            // Fallback
            return this.highlightSync(code, language);
        }
    }

    /**
     * Debounced версия подсветки для интерактивного использования
     */
    highlightDebounced = highlightDebounce((code, language, callback) => {
        this.highlight(code, language)
            .then(result => callback(null, result))
            .catch(error => callback(error, null));
    }, 300);

    /**
     * Массовая подсветка с оптимизацией
     */
    async highlightBatch(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        // Разделяем на кэшированные и нет
        const results = [];
        const toProcess = [];

        for (const item of items) {
            const cached = highlightCache.get(item.code, item.language);
            if (cached) {
                results.push({
                    ...item,
                    highlighted: cached.result,
                    fromCache: true
                });
            } else {
                toProcess.push(item);
            }
        }

        // Обрабатываем остальные
        if (toProcess.length > 0) {
            const promises = toProcess.map(item => 
                this.highlight(item.code, item.language)
                    .then(highlighted => ({
                        ...item,
                        highlighted,
                        fromCache: false
                    }))
            );

            const processed = await Promise.all(promises);
            results.push(...processed);
        }

        return results;
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        highlightCache.clear();
        this.pendingRequests.clear();
        this.listeners = [];
        this.ready = false;
    }

    /**
     * Получение статистики кэша
     */
    getCacheStats() {
        return highlightCache.getStats();
    }

    /**
     * Подписка на события
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Отписка от событий
     */
    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
}

// Экспортируем синглтон
//export const syntaxHighlighter = new SyntaxHighlighterService();

// Экспортируем синглтон
export const SyntaxHighlighter = new SyntaxHighlighterService();

// Также экспортируем класс для тестирования
export { SyntaxHighlighterService };