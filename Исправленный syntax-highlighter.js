// src/services/syntax-highlighter.js

import { highlightCache } from './syntax-highlighter-cache';
import { highlightDebounce } from '../utils/debounce';

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

    getWorkerCode() {
        return `
            // Простая подсветка синтаксиса в Worker
            const SUPPORTED_LANGUAGES = ${JSON.stringify(SUPPORTED_LANGUAGES)};
            
            function normalizeLanguage(lang) {
                if (!lang) return 'text';
                const normalized = lang.toLowerCase().trim();
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

            function highlightSync(code, language) {
                const lang = normalizeLanguage(language);
                const escaped = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                
                // Базовая подсветка для ключевых слов
                const keywords = [
                    'function', 'return', 'var', 'let', 'const', 'if', 'else', 'for', 'while',
                    'class', 'interface', 'extends', 'implements', 'import', 'export', 'default',
                    'async', 'await', 'try', 'catch', 'throw', 'finally', 'new', 'this', 'super',
                    'typeof', 'instanceof', 'void', 'delete', 'switch', 'case', 'break', 'continue',
                    'do', 'in', 'of', 'from', 'as', 'type', 'enum', 'implements', 'public', 'private',
                    'protected', 'static', 'readonly', 'abstract', 'override', 'final', 'dynamic',
                    'base', 'const', 'factory', 'operator', 'part', 'required', 'typedef'
                ];
                
                const keywordPattern = new RegExp('\\\\b(' + keywords.join('|') + ')\\\\b', 'g');
                
                let result = escaped;
                
                // Подсветка строк
                result = result.replace(/(["'])((?:(?!\x01).)*?)\x01/g, (match, quote, content) => {
                    return \`<span class="hljs-string">\${match}</span>\`;
                });
                
                // Подсветка комментариев
                result = result.replace(/\/\/.*$/gm, (match) => {
                    return \`<span class="hljs-comment">\${match}</span>\`;
                });
                
                result = result.replace(/\/\*[\s\S]*?\*\//g, (match) => {
                    return \`<span class="hljs-comment">\${match}</span>\`;
                });
                
                // Подсветка ключевых слов
                result = result.replace(keywordPattern, (match) => {
                    return \`<span class="hljs-keyword">\${match}</span>\`;
                });
                
                // Подсветка чисел
                result = result.replace(/\\b(\\d+\\.?\\d*)\\b/g, (match) => {
                    return \`<span class="hljs-number">\${match}</span>\`;
                });
                
                // Подсветка функций (только для некоторых языков)
                if (lang !== 'text' && lang !== 'html' && lang !== 'css') {
                    result = result.replace(/\\b([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(/g, (match, name) => {
                        return \`<span class="hljs-function">\${name}</span>(\`;
                    });
                }
                
                return \`<code class="hljs language-\${lang}">\${result}</code>\`;
            }

            self.addEventListener('message', (event) => {
                const { id, code, language } = event.data;
                try {
                    const result = highlightSync(code, language);
                    self.postMessage({ id, success: true, result });
                } catch (error) {
                    self.postMessage({ id, success: false, error: error.message });
                }
            });
        `;
    }

    handleWorkerMessage(event) {
        const { id, success, result, error } = event.data;
        
        const request = this.pendingRequests.get(id);
        if (!request) return;
        
        this.pendingRequests.delete(id);
        
        if (success && request.code) {
            highlightCache.set(request.code, request.language || 'text', result);
        }
        
        if (success) {
            request.resolve(result);
        } else {
            request.reject(new Error(error));
        }
    }

    handleWorkerError(error) {
        for (const [id, request] of this.pendingRequests) {
            request.reject(new Error('Worker error: ' + error.message));
            this.pendingRequests.delete(id);
        }
    }

    highlightSync(code, language) {
        const lang = normalizeLanguage(language);
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
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
        
        return `<code class="hljs language-${lang}">${result}</code>`;
    }

    async highlight(code, language = null) {
        try {
            if (!code || typeof code !== 'string') {
                throw new Error('Неверный код для подсветки');
            }

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

            // Если Worker не поддерживается или не готов
            if (!this.isWorkerSupported || !this.ready) {
                const result = this.highlightSync(code, normalizedLang);
                highlightCache.set(code, normalizedLang, result);
                return result;
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
                        language: normalizedLang
                    });

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
            return this.highlightSync(code, language);
        }
    }

    highlightDebounced = highlightDebounce((code, language, callback) => {
        this.highlight(code, language)
            .then(result => callback(null, result))
            .catch(error => callback(error, null));
    }, 300);

    async highlightBatch(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const results = [];
        const toProcess = [];

        for (const item of items) {
            const lang = normalizeLanguage(item.language);
            const cached = highlightCache.get(item.code, lang);
            if (cached) {
                results.push({
                    ...item,
                    highlighted: cached.result,
                    fromCache: true
                });
            } else {
                toProcess.push({ ...item, language: lang });
            }
        }

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

    getCacheStats() {
        return highlightCache.getStats();
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

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
export const syntaxHighlighter = new SyntaxHighlighterService();

// Также экспортируем класс для тестирования
export { SyntaxHighlighterService, SUPPORTED_LANGUAGES, normalizeLanguage };