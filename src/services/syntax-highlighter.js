// src/services/syntax-highlighter.js

import { highlightCache } from './syntax-highlighter-cache.js';
import { highlightDebounce } from '../utils/debounce.js';

// Список поддерживаемых языков
const SUPPORTED_LANGUAGES = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 
    'c', 'cpp', 'c++', 'java', 'csharp', 'cs', 'sql', 
    'html', 'css', 'bash', 'sh', 'go', 'rust', 'rs', 
    'php', 'text', 'dart', 'json', 'xml', 'yaml', 'yml',
    'markdown', 'md', 'ruby', 'rb', 'swift', 'kotlin', 'kt'
];

// Нормализация названия языка
function normalizeLanguage(lang) {
    if (!lang) return 'text';
    const normalized = lang.toLowerCase().trim();
    
    // Алиасы языков
    const aliases = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'cpp': 'c++',
        'c++': 'cpp',
        'cs': 'csharp',
        'sh': 'bash',
        'rs': 'rust',
        'rb': 'ruby',
        'kt': 'kotlin',
        'md': 'markdown',
        'yml': 'yaml'
    };
    
    return aliases[normalized] || normalized;
}

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
        this.workerInitialized = false;
        this.workerInitPromise = null;
        
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

        if (this.workerInitPromise) {
            return this.workerInitPromise;
        }

        this.workerInitPromise = new Promise((resolve) => {
        try {
                // Определяем путь к worker (с учётом разных окружений)
                let workerUrl;
                
                // Пробуем разные способы определения пути
                try {
                    // В браузере с модулями
                    const scriptUrl = import.meta.url;
                    const basePath = scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
                    workerUrl = new URL('syntax-highlighter.worker.js', basePath).href;
                } catch (e) {
                    // Fallback
                    workerUrl = 'src/services/syntax-highlighter.worker.js';
                }
                
                this.worker = new Worker(workerUrl);
            
            this.worker.addEventListener('message', (event) => {
                this.handleWorkerMessage(event);
            });
            
            this.worker.addEventListener('error', (error) => {
                console.error('Worker ошибка:', error);
                this.handleWorkerError(error);
            });
            
            this.ready = true;
                this.workerInitialized = true;
                console.log('✅ Web Worker инициализирован');
                resolve(true);
                
        } catch (error) {
            console.error('Ошибка инициализации Worker:', error);
            this.ready = true;
                this.workerInitialized = false;
                resolve(false);
            }
        });

        return this.workerInitPromise;
    }

    /**
     * Обработка сообщений от Worker
     */
    handleWorkerMessage(event) {
        //const { id, success, result, error, language } = event.data;
        const { id, success, result, error } = event.data;

        const request = this.pendingRequests.get(id);
        if (!request) return;
        
        this.pendingRequests.delete(id);
        
        // Сохраняем в кэш при успехе
        if (success && request.code) {
            const lang = normalizeLanguage(request.language || 'text');
            highlightCache.set(request.code, lang, result);
        }
        
        // Вызываем колбэк
        if (success) {
            request.resolve(result);
        } else {
            request.reject(new Error(error || 'Неизвестная ошибка'));
        }
    }

    /**
     * Обработка ошибок Worker
     */
    handleWorkerError(error) {
        // Отклоняем все ожидающие запросы
        for (const [id, request] of this.pendingRequests) {
request.reject(new Error('Worker error: ' + (error.message || 'Неизвестная ошибка')));
            this.pendingRequests.delete(id);
        }
    }

    /**
     * Синхронная подсветка (fallback для worker)
     * Используется как синхронная альтернатива с кэшированием
     */
    highlightSync(code, language) {
        // Базовая реализация для fallback
        // В реальном проекте используйте полноценную реализацию

        const lang = normalizeLanguage(language);     

        // Проверяем кэш
        const cached = highlightCache.get(code, lang);
        if (cached) {
            return cached.result;
        }

        // Базовая синхронная подсветка
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Ключевые слова для подсветки            
        // Базовая подсветка для ключевых слов
        const keywords = [
            'function', 'return', 'var', 'let', 'const', 'if', 'else', 'for', 'while',
            'class', 'interface', 'extends', 'implements', 'import', 'export', 'default',
            'async', 'await', 'try', 'catch', 'throw', 'finally', 'new', 'this', 'super',
            'typeof', 'instanceof', 'void', 'delete', 'switch', 'case', 'break', 'continue',
            'do', 'in', 'of', 'from', 'as', 'type', 'enum', 'public', 'private',
            'protected', 'static', 'readonly', 'abstract', 'override', 'final', 'dynamic',
            'base', 'const', 'factory', 'operator', 'part', 'required', 'typedef'
        ];
        
        const keywordPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g');
        
        let result = escaped;
        
        // Подсветка строк
        result = result.replace(/(["'])((?:(?!\1).)*?)\1/g, (match) => {
            return `<span class="hljs-string">${match}</span>`;
        });
        
        // Подсветка комментариев
        result = result.replace(/\/\/.*$/gm, (match) => {
            return `<span class="hljs-comment">${match}</span>`;
        });
        
        result = result.replace(/\/\*[\s\S]*?\*\//g, (match) => {
            return `<span class="hljs-comment">${match}</span>`;
        });
        
        // Подсветка ключевых слов
        result = result.replace(keywordPattern, (match) => {
            return `<span class="hljs-keyword">${match}</span>`;
        });
        
        // Подсветка чисел
        result = result.replace(/\b(\d+\.?\d*)\b/g, (match) => {
            return `<span class="hljs-number">${match}</span>`;
        });
        
        // Подсветка функций
        if (lang !== 'text' && lang !== 'html' && lang !== 'css') {
            result = result.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, name) => {
                return `<span class="hljs-function">${name}</span>(`;
            });
        }
        
        const finalResult = `<code class="hljs language-${lang}">${result}</code>`;
        
        // Сохраняем в кэш
        highlightCache.set(code, lang, finalResult);
        
        return finalResult;
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

/*
            // Валидация языка
            const validLanguages = ['javascript', 'python', 'c', 'java', 'csharp', 'sql', 'html', 'css', 'bash', 'go', 'rust', 'php', 'text'];
            if (language && !validLanguages.includes(language)) {
                console.warn(`Неизвестный язык "${language}", используется автоопределение`);
                language = null;
            }
*/

            // Нормализация языка
            const normalizedLang = normalizeLanguage(language);
            
            // Проверка языка (просто предупреждение, но не блокируем)
            if (language && !SUPPORTED_LANGUAGES.includes(normalizedLang)) {
                console.warn(`Неизвестный язык "${language}", используется автоопределение`);
            }

            // Проверка кэша
            const cached = highlightCache.get(code, normalizedLang);
            if (cached) {
                return cached.result;
            }

            // Если Worker не поддерживается или не готов, используем синхронный fallback
            if (!this.isWorkerSupported || !this.workerInitialized) {
                // Ждём инициализацию worker
                if (this.workerInitPromise) {
                    await this.workerInitPromise;
                }
                // Если всё ещё не готов, используем синхронный режим
                if (!this.workerInitialized) {
                    return this.highlightSync(code, normalizedLang);
                }
            }

            // Отправка задачи в Worker
            return new Promise((resolve, reject) => {
                const id = ++this.requestId;
                
                this.pendingRequests.set(id, {
                    resolve,
                    reject,
                    code,
                    language: normalizedLang,
                    timestamp: Date.now()
                });

                try {
                    this.worker.postMessage({
                        id,
                        code,
                        //language: language || 'auto'
                        language: normalizedLang                        
                    });

                    // Таймаут для предотвращения зависаний
                    setTimeout(() => {
                        if (this.pendingRequests.has(id)) {
                            this.pendingRequests.delete(id);
                            // При таймауте используем синхронный fallback
                            try {
                                const fallbackResult = this.highlightSync(code, normalizedLang);
                                resolve(fallbackResult);
                            } catch (e) {
                            reject(new Error('Timeout при подсветке кода'));
                        }
                        }
                    }, 50000);
                } catch (error) {
                    this.pendingRequests.delete(id);
                    // При ошибке используем синхронный fallback
                    try {
                        const fallbackResult = this.highlightSync(code, normalizedLang);
                        resolve(fallbackResult);
                    } catch (e) {
                    reject(error);
                    }
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
            //const cached = highlightCache.get(item.code, item.language);
            const lang = normalizeLanguage(item.language);
            const cached = highlightCache.get(item.code, lang);            
            if (cached) {
                results.push({
                    ...item,
                    highlighted: cached.result,
                    fromCache: true
                });
            } else {
                //toProcess.push(item);
                toProcess.push({ ...item, language: lang });                
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
        this.workerInitialized = false;
        this.workerInitPromise = null;
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

    // Статический метод для удобства
    static highlight(code, language) {
        return syntaxHighlighter.highlight(code, language);
    }    
}

// Экспортируем синглтон
//export const syntaxHighlighter = new SyntaxHighlighterService();

// Экспортируем синглтон
/*
export const SyntaxHighlighter = new SyntaxHighlighterService();
*/
// Также экспортируем класс для тестирования
//export { SyntaxHighlighterService };

// Экспортируем синглтон
export const syntaxHighlighter = new SyntaxHighlighterService();

// Также экспортируем класс для тестирования
export { SyntaxHighlighterService, SUPPORTED_LANGUAGES, normalizeLanguage };