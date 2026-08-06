// src/services/sanitizer.js
import { CONFIG } from '../config.js';

/**
 * Функции для санитизации и валидации ввода
 */
export function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export function sanitizeText(text) {
    if (!text) return '';
    let clean = String(text);
    if (clean.length > CONFIG.SECURITY.MAX_INPUT_LENGTH) {
        clean = clean.substring(0, CONFIG.SECURITY.MAX_INPUT_LENGTH);
    }
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
    clean = clean.replace(/on\w+\s*=/gi, '');
    return clean.trim();
}

export function sanitizeMessage(content) {
    if (CONFIG.SECURITY.SANITIZE_HTML) {
        return sanitizeText(content);
    }
    return content;
}

export function validateInput(text) {
    if (!text) return { valid: false, reason: 'Пустой ввод' };
    if (text.length > CONFIG.LIMITS.MAX_INPUT_LENGTH) {
        return { valid: false, reason: `Превышен лимит ${CONFIG.LIMITS.MAX_INPUT_LENGTH} символов` };
    }
    const dangerous = ['--', '; DROP', '; DELETE', 'UNION SELECT'];
    for (const d of dangerous) {
        if (text.toUpperCase().includes(d)) {
            return { valid: false, reason: 'Обнаружена потенциально опасная конструкция' };
        }
    }
    return { valid: true };
}

export function detectSQLInjection(text) {
    const patterns = [
        /(\bSELECT\b.*\bFROM\b)/i,
        /(\bINSERT\b.*\bINTO\b)/i,
        /(\bUPDATE\b.*\bSET\b)/i,
        /(\bDELETE\b.*\bFROM\b)/i,
        /(\bDROP\b.*\bTABLE\b)/i,
        /(\bUNION\b.*\bSELECT\b)/i,
        /(--)/,
        /(;.*\bDROP\b)/i
    ];
    for (const pattern of patterns) {
        if (pattern.test(text)) return true;
    }
    return false;
}

export function validateLength(text) {
    return text.length <= CONFIG.LIMITS.MAX_INPUT_LENGTH;
}