// src/services/syntax-highlighter-optimizations.js

/**
 * Дополнительные оптимизации для подсветки синтаксиса
 */

// 1. Предварительная компиляция регулярных выражений
export class RegexCache {
    constructor() {
        this.cache = new Map();
    }

    get(pattern, flags) {
        const key = `${pattern}:${flags}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, new RegExp(pattern, flags));
        }
        return this.cache.get(key);
    }

    clear() {
        this.cache.clear();
    }
}

// 2. Токенизация с сохранением позиций
export class Tokenizer {
    tokenize(code, rules) {
        const tokens = [];
        let position = 0;
        const codeLength = code.length;

        while (position < codeLength) {
            let matched = false;
            
            for (const rule of rules) {
                rule.pattern.lastIndex = position;
                const match = rule.pattern.exec(code);
                
                if (match && match.index === position) {
                    tokens.push({
                        type: rule.class,
                        value: match[0],
                        start: position,
                        end: position + match[0].length
                    });
                    position += match[0].length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Текст без подсветки
                const nextMatch = this.findNextMatch(code, position, rules);
                const end = nextMatch !== -1 ? nextMatch : codeLength;
                tokens.push({
                    type: 'text',
                    value: code.substring(position, end),
                    start: position,
                    end: end
                });
                position = end;
            }
        }

        return tokens;
    }

    findNextMatch(code, position, rules) {
        let minIndex = -1;
        for (const rule of rules) {
            rule.pattern.lastIndex = position;
            const match = rule.pattern.exec(code);
            if (match && (minIndex === -1 || match.index < minIndex)) {
                minIndex = match.index;
            }
        }
        return minIndex;
    }
}

// 3. Адаптивная стратегия кэширования
export class AdaptiveCache {
    constructor() {
        this.cache = new Map();
        this.accessCount = new Map();
        this.maxSize = 100;
        this.threshold = 3; // Минимальное количество обращений для сохранения
    }

    get(key) {
        if (this.cache.has(key)) {
            const count = this.accessCount.get(key) || 0;
            this.accessCount.set(key, count + 1);
            return this.cache.get(key);
        }
        return null;
    }

    set(key, value) {
        this.cache.set(key, value);
        this.accessCount.set(key, 0);
        
        if (this.cache.size > this.maxSize) {
            this.evict();
        }
    }

    evict() {
        // Удаляем элементы с наименьшим количеством обращений
        const entries = Array.from(this.accessCount.entries());
        entries.sort((a, b) => a[1] - b[1]);
        
        // Удаляем 20% самых непопулярных
        const toRemove = Math.ceil(entries.length * 0.2);
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            const [key] = entries[i];
            this.cache.delete(key);
            this.accessCount.delete(key);
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            totalAccesses: Array.from(this.accessCount.values()).reduce((a, b) => a + b, 0)
        };
    }
}