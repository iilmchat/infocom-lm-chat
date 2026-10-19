// src/services/sanitizer.js
import { CONFIG } from '../config.js';

/**
 * Функции для санитизации и валидации ввода
 */

// ПРОБЛЕМА 1: Функция не обрабатывает null/undefined и может выбросить ошибку
// ПРОБЛЕМА 2: textContent экранирует HTML, но потом мы возвращаем innerHTML - это бессмысленно
// Рекомендация: использовать textContent для вставки в DOM или возвращать экранированную строку
export function sanitizeHTML(str) {
    // Исправлено: проверка на null/undefined
    if (str === null || str === undefined) return '';
    
    const div = document.createElement('div');
    // ПРОБЛЕМА: если str - не строка, а объект, может быть ошибка
    // Исправлено: принудительное преобразование в строку
    div.textContent = String(str);
    return div.innerHTML;
}

// ПРОБЛЕМА: функция может выбросить ошибку при работе с символами суррогатных пар
// ПРОБЛЕМА: регулярные выражения могут работать некорректно с большими строками
// ПРОБЛЕМА: replace для script тегов не удаляет вложенные теги корректно
export function sanitizeText(text) {
    // Исправлено: проверка на null/undefined
    if (text === null || text === undefined) return '';
    
    let clean = String(text);
    
    // ПРОБЛЕМА: substring может разорвать суррогатную пару (emoji)
    // Исправлено: использование правильной обрезки с учётом Unicode
    if (clean.length > CONFIG.SECURITY.MAX_INPUT_LENGTH) {
        // Используем spread для правильной работы с Unicode
        const chars = [...clean];
        if (chars.length > CONFIG.SECURITY.MAX_INPUT_LENGTH) {
            clean = chars.slice(0, CONFIG.SECURITY.MAX_INPUT_LENGTH).join('');
        }
    }
    
    // ПРОБЛЕМА: эти замены небезопасны, т.к. не учитывают регистр и пробелы
    // Исправлено: улучшенные регулярные выражения
    // Удаляем теги script (с учётом вложенности и атрибутов)
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Удаляем обработчики событий (с учётом пробелов и кавычек)
    clean = clean.replace(/\bon\w+\s*=\s*["']?[^"'\s>]*["']?/gi, '');
    
    // ДОПОЛНИТЕЛЬНО: экранируем потенциально опасные символы для HTML
    clean = clean.replace(/[&<>"]/g, function(match) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        };
        return escapeMap[match];
    });
    
    return clean.trim();
}

// ПРОБЛЕМА: не проверяет наличие CONFIG.SECURITY
export function sanitizeMessage(content) {
    // Добавлена проверка на существование конфигурации
    if (CONFIG?.SECURITY?.SANITIZE_HTML !== false) {
        return sanitizeText(content);
    }
    return content || '';
}

// ПРОБЛЕМА: проверка на SQL инъекции слишком простая и может давать ложные срабатывания
// ПРОБЛЕМА: не учитывает регистр в опасных конструкциях
export function validateInput(text) {
    // Исправлено: проверка на null/undefined и пустую строку
    if (text === null || text === undefined || text === '') {
        return { valid: false, reason: 'Пустой ввод' };
    }
    
    // Проверка на существование конфигурации
    const maxLength = CONFIG?.LIMITS?.MAX_INPUT_LENGTH || 10000;
    if (text.length > maxLength) {
        return { valid: false, reason: `Превышен лимит ${maxLength} символов` };
    }

    // // ПРОБЛЕМА: массив опасных конструкций неполный и не учитывает вариации
    // // Исправлено: расширенный список с учётом разных вариаций
    // const dangerous = [
    //     '--', 
    //     '; DROP', 
    //     '; DELETE', 
    //     'UNION SELECT',
    //     '/*',           // комментарии SQL
    //     '*/',
    //     'xp_',          // хранимые процедуры
    //     'sp_',
    //     '0x',           // шестнадцатеричные литералы
    //     'EXEC(',        // выполнение
    //     'EXECUTE(',
    //     'WAITFOR'       // задержка для атак
    // ];
    
    // const upperText = text.toUpperCase();
    // for (const d of dangerous) {
    //     if (upperText.includes(d.toUpperCase())) {
    //         return { valid: false, reason: 'Обнаружена потенциально опасная конструкция' };
    //     }
    // }

    return { valid: true };
}

// ПРОБЛЕМА: функция дублирует функциональность validateInput
// ПРОБЛЕМА: не обрабатывает ошибки регулярных выражений
export function detectSQLInjection(text) {
    // Добавлена проверка на null/undefined
    if (!text) return false;
    
    try {
        const patterns = [
            /\bSELECT\b.*\bFROM\b/i,
            /\bINSERT\b.*\bINTO\b/i,
            /\bUPDATE\b.*\bSET\b/i,
            /\bDELETE\b.*\bFROM\b/i,
            /\bDROP\b.*\bTABLE\b/i,
            /\bUNION\b.*\bSELECT\b/i,
            /--/,
            /;.*\bDROP\b/i,
            // ДОПОЛНИТЕЛЬНЫЕ паттерны
            /\bEXEC\b/i,
            /\bEXECUTE\b/i,
            /\bXP_/i,
            /\bSP_/i,
            /\/\*.*\*\//,  // многострочные комментарии
            /\bWAITFOR\b/i
        ];
        
        // ПРОБЛЕМА: если text очень большой, может замедлить работу
        // Исправлено: ограничение длины проверяемой строки
        const checkText = text.length > 1000 ? text.substring(0, 1000) : text;
        
        for (const pattern of patterns) {
            if (pattern.test(checkText)) return true;
        }
    } catch (error) {
        // Обработка ошибок регулярных выражений
        console.warn('Ошибка при проверке SQL инъекции:', error);
        return true; // В случае ошибки лучше заблокировать
    }
    
    return false;
}

// ПРОБЛЕМА: не проверяет существование CONFIG
export function validateLength(text) {
    // Проверка на null/undefined и существование конфигурации
    if (!text) return true;
    const maxLength = CONFIG?.LIMITS?.MAX_INPUT_LENGTH || 10000;
    return text.length <= maxLength;
}

// ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ: безопасное экранирование для различных контекстов
export function safeEscape(text, context = 'html') {
    if (!text) return '';
    const str = String(text);
    
    switch(context) {
        case 'html':
            return str.replace(/[&<>"']/g, function(m) {
                const map = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#x27;'
                };
                return map[m];
            });
        case 'attribute':
            return str.replace(/["']/g, '&quot;');
        case 'url':
            return encodeURIComponent(str);
        case 'json':
            return JSON.stringify(str).slice(1, -1);
        default:
            return str;
    }
}

// ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ: комплексная проверка ввода
export function validateAndSanitize(input) {
    try {
        // Проверка на null/undefined
        if (input === null || input === undefined) {
            return { valid: false, reason: 'Ввод отсутствует', sanitized: '' };
        }
        
        // Проверка типа
        if (typeof input !== 'string') {
            return { valid: false, reason: 'Неверный тип данных', sanitized: '' };
        }
        
        // Проверка длины
        const lengthCheck = validateLength(input);
        if (!lengthCheck) {
            return { 
                valid: false, 
                reason: `Превышен лимит символов`,
                sanitized: input.substring(0, CONFIG?.LIMITS?.MAX_INPUT_LENGTH || 10000)
            };
        }
        
        // Проверка на SQL инъекции
        if (detectSQLInjection(input)) {
            return { valid: false, reason: 'Обнаружена SQL инъекция', sanitized: '' };
        }
        
        // Санитизация
        const sanitized = sanitizeMessage(input);
        
        return { valid: true, sanitized };
    } catch (error) {
        console.error('Ошибка валидации:', error);
        return { valid: false, reason: 'Внутренняя ошибка валидации', sanitized: '' };
    }
}