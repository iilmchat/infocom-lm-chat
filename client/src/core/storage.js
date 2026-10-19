// src/core/storage.js
/**
 * Утилиты для работы с localStorage
 */
export class Storage {
    /**
     * Получить данные из localStorage
     * @param {string} key - Ключ
     * @param {*} defaultValue - Значение по умолчанию
     * @returns {*} Данные
     */
    static get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return defaultValue;
            return JSON.parse(data);
        } catch (error) {
            console.warn(`Storage: Ошибка чтения ключа "${key}"`, error);
            return defaultValue;
        }
    }

    /**
     * Сохранить данные в localStorage
     * @param {string} key - Ключ
     * @param {*} value - Данные
     * @returns {boolean} Успех операции
     */
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Storage: Ошибка сохранения ключа "${key}"`, error);
            return false;
        }
    }

    /**
     * Удалить данные из localStorage
     * @param {string} key - Ключ
     * @returns {boolean} Успех операции
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Storage: Ошибка удаления ключа "${key}"`, error);
            return false;
        }
    }

    /**
     * Проверить наличие ключа
     * @param {string} key - Ключ
     * @returns {boolean} Наличие ключа
     */
    static has(key) {
        return localStorage.getItem(key) !== null;
    }

    /**
     * Очистить все данные
     */
    static clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Storage: Ошибка очистки', error);
            return false;
        }
    }

    /**
     * Получить все ключи
     * @returns {string[]} Массив ключей
     */
    static keys() {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.warn('Storage: Ошибка получения ключей', error);
            return [];
        }
    }
}