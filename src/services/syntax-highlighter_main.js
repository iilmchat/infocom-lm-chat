// src/services/syntax-highlighter.js

/**
 * Подсветка синтаксиса кода
 */
export const SyntaxHighlighter = {
    detectLanguage(code) {
        // JavaScript/TypeScript
        if (/^\s*(function|const|let|var|if|else|for|while|return|import|export|require|module|exports|async|await|try|catch|finally|throw|switch|case|break|continue|default|delete|in|instanceof|typeof|void|with|yield)\b/m.test(code)) {
            return 'javascript';
        }
        // Python
        if (/^\s*(def|import|from|if|elif|else|for|while|return|with|as|try|except|finally|raise|yield|lambda|del|pass|assert|nonlocal|global)\b/m.test(code)) {
            return 'python';
        }
        // C
        if (/^\s*(#include|int|void|char|ifdef|define|printf|scanf|malloc|free|sizeof|typedef|struct|enum|union|long|short|unsigned|signed|const|volatile|register|static|extern)\b/m.test(code)) {
            return 'c';
        }
        // Java
        if (/^\s*(package|import|public|private|protected|interface|extends|implements|void|int|double|float|long|short|byte|char|boolean|String|new|this|super|static|final|abstract|synchronized|volatile|transient|native|strictfp)\b/m.test(code)) {
            return 'java';
        }
        // C#
        if (/^\s*(using|namespace|public|private|protected|virtual|override|void|int|string|new|this|base|static|readonly|const|async|await|partial|sealed|internal|abstract|event|delegate|lock)\b/m.test(code)) {
            return 'csharp';
        }
        // SQL
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|UNION|DISTINCT|COUNT|SUM|AVG|MAX|MIN)\b/mi.test(code)) {
            return 'sql';
        }
        // HTML
        if (/^\s*(<!DOCTYPE|html|head|body|div|span|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|script|style|meta|link|section|article|nav|header|footer|main|aside|figure|figcaption|h1|h2|h3|h4|h5|h6)\b/mi.test(code)) {
            return 'html';
        }
        // CSS
        if (/^\s*([.#][a-zA-Z_][\w-]*|\w+\s*\{|@media|@keyframes|@import|@font-face|:\w+|::\w+)/m.test(code)) {
            return 'css';
        }
        // Bash
        if (/^#!\s*\/bin\/(bash|sh|zsh|fish|ksh)/m.test(code) || /^#!\s*\/usr\/bin\/env\s+(bash|sh|zsh|fish|ksh)/m.test(code)) {
            return 'bash';
        }
        // Go
        if (/^\s*(package|import|func|var|const|type|struct|interface|map|chan|go|defer|select|range|switch|case|fallthrough|default|if|else|for|return|break|continue|goto)\b/m.test(code)) {
            return 'go';
        }
        // Rust
        if (/^\s*(use|fn|pub|struct|impl|trait|match|if|let|mut|ref|box|move|loop|while|for|in|return|mod|extern|crate|unsafe|async|await|dyn|static|const|enum|union|type)\b/m.test(code)) {
            return 'rust';
        }
        // PHP
        if (/^\s*(<\?php|echo|print|function|if|else|elseif|for|foreach|while|switch|case|break|continue|return|class|new|this|parent|self|namespace|use|require|include|include_once|require_once|interface|implements|abstract|final|trait)\b/m.test(code)) {
            return 'php';
        }
        return 'text';
    },

    highlightJS(code) {
        const lang = this.detectLanguage(code);
        let result = this.escapeHTML(code);

        const rules = [
            { pattern: /(".*?")/g, class: 'hljs-string' },
            { pattern: /('.*?')/g, class: 'hljs-string' },
            { pattern: /(`.*?`)/g, class: 'hljs-string' },
            { pattern: /(\/\/.*$)/gm, class: 'hljs-comment' },
            { pattern: /(\/\*[\s\S]*?\*\/)/g, class: 'hljs-comment' },
            { pattern: /(#.*$)/gm, class: 'hljs-comment' },
            { pattern: /\b(\d+)\b/g, class: 'hljs-number' },
            { pattern: /\b(true|false|null|undefined)\b/g, class: 'hljs-literal' }
        ];

        if (lang === 'python') {
            rules.push(
                { pattern: /\b(def|import|from|if|elif|else|for|while|return|with|as|try|except|finally|raise|yield|lambda|del|pass|assert|nonlocal|global)\b/g, class: 'hljs-keyword' },
                { pattern: /\b(print|len|range|type|str|int|float|bool|list|dict|set|tuple|object)\b/g, class: 'hljs-built_in' }
            );
        }

        if (lang === 'java' || lang === 'csharp') {
            rules.push(
                { pattern: /\b(public|private|protected|package|import|interface|extends|implements|void|int|double|float|long|short|byte|char|boolean|String)\b/g, class: 'hljs-keyword' }
            );
        }

        rules.forEach(rule => {
            result = result.replace(rule.pattern, (match) => {
                return `<span class="${rule.class}">${match}</span>`;
            });
        });

        return `<code class="hljs language-${lang}">${result}</code>`;
    },

    escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    highlight(code, language) {
        return this.highlightJS(code);
    }
};