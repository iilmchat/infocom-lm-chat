// src/services/syntax-highlighter.js

/**
 * Подсветка синтаксиса кода
 * Улучшенная версия с правильной обработкой и предотвращением ошибок
 */
export const SyntaxHighlighter = {
    detectLanguage(code) {
        // ... (оставляем без изменений)
    },

    highlightJS(code) {
        const lang = this.detectLanguage(code);
        
        // Экранируем HTML до начала обработки
        let result = this.escapeHTML(code);
        
        // Определяем правила с приоритетами (выше = важнее)
        const rules = [
            // Комментарии (наивысший приоритет)
            { 
                pattern: /(\/\/.*$)/gm, 
                class: 'hljs-comment',
                priority: 3 
            },
            { 
                pattern: /(\/\*[\s\S]*?\*\/)/g, 
                class: 'hljs-comment',
                priority: 3 
            },
            { 
                pattern: /(#.*$)/gm, 
                class: 'hljs-comment',
                priority: 3 
            },
            
            // Строки (средний приоритет)
            { 
                // Учитываем экранированные кавычки внутри строк
                pattern: /("(?:\\.|[^"\\])*")/g, 
                class: 'hljs-string',
                priority: 2
            },
            { 
                pattern: /('(?:\\.|[^'\\])*')/g, 
                class: 'hljs-string',
                priority: 2
            },
            { 
                pattern: /(`(?:\\.|[^`\\])*`)/g, 
                class: 'hljs-string',
                priority: 2
            },
            
            // Числа и литералы
            { 
                pattern: /\b(\d+)\b/g, 
                class: 'hljs-number',
                priority: 1
            },
            { 
                pattern: /\b(true|false|null|undefined)\b/g, 
                class: 'hljs-literal',
                priority: 1
            }
        ];

        // Добавляем специфичные для языка правила
        if (lang === 'python') {
            rules.push(
                { pattern: /\b(def|import|from|if|elif|else|for|while|return|with|as|try|except|finally|raise|yield|lambda|del|pass|assert|nonlocal|global)\b/g, class: 'hljs-keyword', priority: 1 },
                { pattern: /\b(print|len|range|type|str|int|float|bool|list|dict|set|tuple|object)\b/g, class: 'hljs-built_in', priority: 1 }
            );
        }

        if (lang === 'java' || lang === 'csharp') {
            rules.push(
                { pattern: /\b(public|private|protected|package|import|interface|extends|implements|void|int|double|float|long|short|byte|char|boolean|String)\b/g, class: 'hljs-keyword', priority: 1 }
            );
        }

        // Сортируем правила по приоритету (от высокого к низкому)
        rules.sort((a, b) => b.priority - a.priority);

        // Применяем правила с защитой от повторных оберток
        // Используем маркеры, чтобы избежать конфликтов
        const markers = [];
        let markerIndex = 0;
        
        // Сначала применяем правила с высоким приоритетом, используя маркеры
        let tempResult = result;
        
        // Проходим по каждому правилу
        rules.forEach(rule => {
            tempResult = tempResult.replace(rule.pattern, (match) => {
                // Создаем уникальный маркер
                const marker = `__HLJS_MARKER_${markerIndex++}__`;
                const replacement = `<span class="${rule.class}">${match}</span>`;
                markers.push({ marker, replacement });
                return marker;
            });
        });
        
        // Заменяем маркеры на финальную разметку
        markers.forEach(({ marker, replacement }) => {
            tempResult = tempResult.replace(new RegExp(marker, 'g'), replacement);
        });

        return `<code class="hljs language-${lang}">${tempResult}</code>`;
    },

    escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    highlight(code, language) {
        try {
            // Добавляем защиту от ошибок
            if (!code || typeof code !== 'string') {
                console.warn('SyntaxHighlighter: Invalid code parameter');
                return '<code class="hljs language-text">Invalid code</code>';
            }
            
            return this.highlightJS(code);
        } catch (error) {
            console.error('Syntax highlighting error:', error);
            // Возвращаем безопасный fallback
            return `<code class="hljs language-text">${this.escapeHTML(code)}</code>`;
        }
    }
};

