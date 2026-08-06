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