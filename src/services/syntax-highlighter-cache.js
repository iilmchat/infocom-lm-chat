// src/services/syntax-highlighter-cache.js

/**
 * Кэш для подсветки синтаксиса
 * Использует Map с LRU-подобной стратегией
 */

class SyntaxHighlighterCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Генерация ключа для кэша
     */
    getKey(code, language) {
        // Используем хеш для длинных строк
        if (code.length > 1000) {
            return `${language}:${this.hashCode(code)}`;
        }
        return `${language}:${code}`;
    }

    /**
     * Простая хеш-функция для строк
     */
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Преобразование в 32-битное целое
        }
        return hash.toString(36);
    }

    /**
     * Получение значения из кэша
     */
    get(code, language = null) {
        const key = this.getKey(code, language);
        if (this.cache.has(key)) {
            this.hits++;
            const value = this.cache.get(key);
            // Обновляем позицию (LRU)
            this.cache.delete(key);
            this.cache.set(key, value);
            return value;
        }
        this.misses++;
        return null;
    }

    /**
     * Сохранение значения в кэш
     */
    set(code, language, result) {
        const key = this.getKey(code, language);
        
        // Проверяем размер кэша
        if (this.cache.size >= this.maxSize) {
            // Удаляем первый элемент (самый старый)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            result,
            timestamp: Date.now(),
            language
        });
    }

    /**
     * Очистка кэша
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Удаление старых записей (по времени)
     */
    clean(maxAge = 3600000) { // 1 час по умолчанию
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Получение статистики кэша
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
        };
    }
}

// Экспортируем синглтон
export const highlightCache = new SyntaxHighlighterCache(150);
/*
class HighlightCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(code, language) {
        const key = this.getKey(code, language);
        if (this.cache.has(key)) {
            const entry = this.cache.get(key);
            return entry;
        }
        return null;
    }

    set(code, language, result) {
        const key = this.getKey(code, language);
        // Если кэш переполнен, удаляем старые записи
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, { result, timestamp: Date.now() });
    }

    getKey(code, language) {
        return `${language}:${code.substring(0, 100)}_${code.length}`;
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }
}

export const highlightCache = new HighlightCache();
*/