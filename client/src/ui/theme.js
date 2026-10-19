// src/ui/theme.js
import { CONFIG } from '../config.js';

/**
 * Управление темами оформления
 */
let currentTheme = localStorage.getItem('chat_theme') || CONFIG.UI_CONFIG.DEFAULT_THEME;

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chat_theme', theme);
    currentTheme = theme;
}

export function getCurrentTheme() {
    return currentTheme;
}

export function cycleTheme() {
    const currentIndex = CONFIG.THEMES.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % CONFIG.THEMES.length;
    const newTheme = CONFIG.THEMES[nextIndex];
    applyTheme(newTheme);
    return newTheme;
}

export function getAvailableThemes() {
    return [...CONFIG.THEMES];
}

export function isDarkTheme() {
    return currentTheme === 'dark';
}

export function isLightTheme() {
    return currentTheme === 'light';
}

export function isMonokaiTheme() {
    return currentTheme === 'monokai';
}

// Поддержка системной темы
export function detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

export function applySystemTheme() {
    const theme = detectSystemTheme();
    applyTheme(theme);
    return theme;
}

// Слушатель изменения системной темы
export function watchSystemTheme(callback) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
        const theme = e.matches ? 'dark' : 'light';
        if (!localStorage.getItem('chat_theme')) {
            applyTheme(theme);
            if (callback) callback(theme);
        }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
}