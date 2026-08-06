// src/services/syntax-highlighter.worker.js

/**
 * Web Worker для подсветки синтаксиса
 * Выполняет тяжелые операции в фоновом потоке
 */

// Импортируем основной модуль (в реальном проекте используйте importScripts или модули)
// Для простоты скопируем необходимые функции

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function detectLanguage(code) {
    if (/^\s*(function|const|let|var|if|else|for|while|return|import|export|require|module|exports|async|await|try|catch|finally|throw|switch|case|break|continue|default|delete|in|instanceof|typeof|void|with|yield)\b/m.test(code)) {
        return 'javascript';
    }
    if (/^\s*(def|import|from|if|elif|else|for|while|return|with|as|try|except|finally|raise|yield|lambda|del|pass|assert|nonlocal|global)\b/m.test(code)) {
        return 'python';
    }
    if (/^\s*(#include|int|void|char|ifdef|define|printf|scanf|malloc|free|sizeof|typedef|struct|enum|union|long|short|unsigned|signed|const|volatile|register|static|extern)\b/m.test(code)) {
        return 'c';
    }
    if (/^\s*(package|import|public|private|protected|interface|extends|implements|void|int|double|float|long|short|byte|char|boolean|String|new|this|super|static|final|abstract|synchronized|volatile|transient|native|strictfp)\b/m.test(code)) {
        return 'java';
    }
    if (/^\s*(using|namespace|public|private|protected|virtual|override|void|int|string|new|this|base|static|readonly|const|async|await|partial|sealed|internal|abstract|event|delegate|lock)\b/m.test(code)) {
        return 'csharp';
    }
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|UNION|DISTINCT|COUNT|SUM|AVG|MAX|MIN)\b/mi.test(code)) {
        return 'sql';
    }
    if (/^\s*(<!DOCTYPE|html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|script|style|meta|link|section|article|nav|header|footer|main|aside|figure|figcaption|h1|h2|h3|h4|h5|h6)\b/mi.test(code)) {
        return 'html';
    }
    if (/^\s*([.#][a-zA-Z_][\w-]*|\w+\s*\{|@media|@keyframes|@import|@font-face|:\w+|::\w+)/m.test(code)) {
        return 'css';
    }
    if (/^#!\s*\/bin\/(bash|sh|zsh|fish|ksh)/m.test(code) || /^#!\s*\/usr\/bin\/env\s+(bash|sh|zsh|fish|ksh)/m.test(code)) {
        return 'bash';
    }
    if (/^\s*(package|import|func|var|const|type|struct|interface|map|chan|go|defer|select|range|switch|case|fallthrough|default|if|else|for|return|break|continue|goto)\b/m.test(code)) {
        return 'go';
    }
    if (/^\s*(use|fn|pub|struct|impl|trait|match|if|let|mut|ref|box|move|loop|while|for|in|return|mod|extern|crate|unsafe|async|await|dyn|static|const|enum|union|type)\b/m.test(code)) {
        return 'rust';
    }
    if (/^\s*(<\?php|echo|print|function|if|else|elseif|for|foreach|while|switch|case|break|continue|return|class|new|this|parent|self|namespace|use|require|include|include_once|require_once|interface|implements|abstract|final|trait)\b/m.test(code)) {
        return 'php';
    }
    return 'text';
}

function highlightJS(code, language) {
    // Валидация языка
    const validLanguages = ['javascript', 'python', 'c', 'java', 'csharp', 'sql', 'html', 'css', 'bash', 'go', 'rust', 'php', 'text'];
    const detectedLang = language && validLanguages.includes(language) ? language : detectLanguage(code);
    
    let result = escapeHTML(code);
    
    // Определяем правила с приоритетами
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

    // Добавляем специфичные правила в зависимости от языка
    if (detectedLang === 'python') {
        rules.push(
            { pattern: /\b(def|import|from|if|elif|else|for|while|return|with|as|try|except|finally|raise|yield|lambda|del|pass|assert|nonlocal|global)\b/g, class: 'hljs-keyword', priority: 1 },
            { pattern: /\b(print|len|range|type|str|int|float|bool|list|dict|set|tuple|object)\b/g, class: 'hljs-built_in', priority: 1 }
        );
    }

    if (detectedLang === 'html') {
        // Добавляем поддержку вложенных тегов в HTML
        rules.push(
            { 
                pattern: /(&lt;[a-zA-Z][a-zA-Z0-9-]*)/g, 
                class: 'hljs-tag',
                priority: 1
            },
            { 
                pattern: /(&lt;\/[a-zA-Z][a-zA-Z0-9-]*)/g, 
                class: 'hljs-tag',
                priority: 1
            },
            { 
                pattern: /\b(class|id|style|src|href|alt|title|data-[\w-]+)\s*=/g, 
                class: 'hljs-attribute',
                priority: 1
            }
        );
    }

    if (detectedLang === 'java' || detectedLang === 'csharp') {
        rules.push(
            { pattern: /\b(public|private|protected|package|import|interface|extends|implements|void|int|double|float|long|short|byte|char|boolean|String)\b/g, class: 'hljs-keyword', priority: 1 }
        );
    }

    // Сортируем правила по приоритету
    rules.sort((a, b) => b.priority - a.priority);

    // Применяем правила с использованием маркеров
    const markers = [];
    let markerIndex = 0;
    let tempResult = result;
    
    rules.forEach(rule => {
        tempResult = tempResult.replace(rule.pattern, (match) => {
            const marker = `__HLJS_MARKER_${markerIndex++}__`;
            const replacement = `<span class="${rule.class}">${match}</span>`;
            markers.push({ marker, replacement });
            return marker;
        });
    });
    
    markers.forEach(({ marker, replacement }) => {
        tempResult = tempResult.replace(new RegExp(marker, 'g'), replacement);
    });

    return {
        html: `<code class="hljs language-${detectedLang}">${tempResult}</code>`,
        language: detectedLang
    };
}

// Обработка сообщений от главного потока
self.addEventListener('message', (event) => {
    const { id, code, language } = event.data;
    
    try {
        // Имитация длительной операции для демонстрации
        // В реальном проекте можно добавить задержку только для тестов
        
        const result = highlightJS(code, language);
        
        self.postMessage({
            id,
            success: true,
            result: result.html,
            language: result.language
        });
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message
        });
    }
});