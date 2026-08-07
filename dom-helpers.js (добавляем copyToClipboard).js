// src/utils/dom-helpers.js

/**
 * Утилиты для работы с DOM
 */

/**
 * Создает безопасный DOM-элемент
 * @param {string} tag - HTML тег
 * @param {Object} attributes - Атрибуты элемента
 * @param {string} textContent - Текстовое содержимое
 * @returns {HTMLElement}
 */
export function createSafeElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([k, v]) => {
                element.dataset[k] = v;
            });
        } else if (key.startsWith('aria')) {
            element.setAttribute(key, value);
        } else {
            element.setAttribute(key, value);
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

/**
 * Безопасная установка текстового содержимого
 * @param {HTMLElement} element - DOM элемент
 * @param {string} text - Текст для вставки
 */
export function setTextContent(element, text) {
    if (element) {
        element.textContent = text;
    }
}

/**
 * Получение элемента по селектору с проверкой
 * @param {string} selector - CSS селектор
 * @returns {HTMLElement|null}
 */
export function getElement(selector) {
    const el = document.querySelector(selector);
    if (!el) {
        console.warn(`Element not found: ${selector}`);
    }
    return el;
}

/**
 * Добавление класса с проверкой
 * @param {HTMLElement} element - DOM элемент
 * @param {string} className - Имя класса
 */
export function addClass(element, className) {
    if (element) {
        element.classList.add(className);
    }
}

/**
 * Удаление класса с проверкой
 * @param {HTMLElement} element - DOM элемент
 * @param {string} className - Имя класса
 */
export function removeClass(element, className) {
    if (element) {
        element.classList.remove(className);
    }
}

/**
 * Переключение класса с проверкой
 * @param {HTMLElement} element - DOM элемент
 * @param {string} className - Имя класса
 */
export function toggleClass(element, className) {
    if (element) {
        element.classList.toggle(className);
    }
}

/**
 * Установка HTML содержимого с санитизацией
 * @param {HTMLElement} element - DOM элемент
 * @param {string} html - HTML строка
 */
export function setSafeHTML(element, html) {
    if (element) {
        const div = document.createElement('div');
        div.textContent = html;
        element.innerHTML = div.innerHTML;
    }
}

/**
 * Копирование текста в буфер обмена с fallback
 * @param {string} text - Текст для копирования
 * @param {Function} onSuccess - Callback при успешном копировании
 * @param {Function} onError - Callback при ошибке
 */
export function copyToClipboard(text, onSuccess, onError) {
    // Проверяем, доступен ли Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                if (onSuccess) onSuccess();
            })
            .catch((err) => {
                console.warn('Clipboard API failed, using fallback:', err);
                fallbackCopy(text, onSuccess, onError);
            });
    } else {
        // Fallback для HTTP и старых браузеров
        fallbackCopy(text, onSuccess, onError);
    }
}

/**
 * Fallback-метод копирования через создание временного элемента
 * @param {string} text - Текст для копирования
 * @param {Function} onSuccess - Callback при успешном копировании
 * @param {Function} onError - Callback при ошибке
 */
function fallbackCopy(text, onSuccess, onError) {
    try {
        // Создаем временный textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        
        document.body.appendChild(textarea);
        
        // Выделяем текст
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        
        // Пытаемся скопировать
        const successful = document.execCommand('copy');
        
        document.body.removeChild(textarea);
        
        if (successful) {
            if (onSuccess) onSuccess();
        } else {
            throw new Error('execCommand copy failed');
        }
    } catch (err) {
        console.warn('Fallback copy failed:', err);
        if (onError) onError(err);
        
        // Показываем текст для ручного копирования
        const message = `Не удалось скопировать автоматически. Выделите текст ниже и нажмите Ctrl+C:\n\n${text}`;
        alert(message);
    }
}

/**
 * Проверяет, доступен ли Clipboard API
 * @returns {boolean}
 */
export function isClipboardAvailable() {
    return !!(navigator.clipboard && navigator.clipboard.writeText);
}

/**
 * Проверяет, является ли контекст защищенным (HTTPS или localhost)
 * @returns {boolean}
 */
export function isSecureContext() {
    return window.isSecureContext || 
           window.location.protocol === 'https:' ||
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '[::1]';
}