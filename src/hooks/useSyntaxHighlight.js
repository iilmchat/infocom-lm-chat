// src/hooks/useSyntaxHighlight.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyntaxHighlighter } from '../services/syntax-highlighter';

/**
 * React Hook для подсветки синтаксиса с управлением состоянием
 */
export function useSyntaxHighlight(initialCode = '', initialLanguage = null) {
    const [code, setCode] = useState(initialCode);
    const [language, setLanguage] = useState(initialLanguage);
    const [highlighted, setHighlighted] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const isMountedRef = useRef(true);
    const highlightTimeoutRef = useRef(null);

    // Функция для выполнения подсветки
    const performHighlight = useCallback(async (codeToHighlight, lang) => {
        if (!codeToHighlight) {
            setHighlighted('');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await SyntaxHighlighter.highlight(codeToHighlight, lang);
            
            if (isMountedRef.current) {
                setHighlighted(result);
            }
        } catch (err) {
            console.error('Ошибка подсветки:', err);
            if (isMountedRef.current) {
                setError(err.message);
                // Fallback - показать исходный код
                setHighlighted(`<code class="hljs language-text">${codeToHighlight.replace(/</g, '&lt;')}</code>`);
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    // Debounced версия подсветки
    const debouncedHighlight = useCallback(
        SyntaxHighlighter.highlightDebounced.bind(SyntaxHighlighter),
        []
    );

    // Автоматическая подсветка при изменении кода или языка
    useEffect(() => {
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }

        highlightTimeoutRef.current = setTimeout(() => {
            performHighlight(code, language);
        }, 200);

        return () => {
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, [code, language, performHighlight]);

    // Очистка при размонтировании
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, []);

    return {
        code,
        setCode,
        language,
        setLanguage,
        highlighted,
        isLoading,
        error,
        // Ручная функция для принудительной подсветки
        highlight: () => performHighlight(code, language),
        // Очистка
        clear: () => {
            setCode('');
            setHighlighted('');
            setError(null);
        }
    };
}

/**
 * Хук для массовой подсветки
 */
export function useBatchSyntaxHighlight() {
    const [items, setItems] = useState([]);
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const highlightItems = useCallback(async (newItems) => {
        if (!newItems || newItems.length === 0) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        try {
            const processed = await syntaxHighlighter.highlightBatch(newItems);
            setResults(processed);
            return processed;
        } catch (error) {
            console.error('Ошибка массовой подсветки:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        items,
        setItems,
        results,
        isLoading,
        highlightItems
    };
}