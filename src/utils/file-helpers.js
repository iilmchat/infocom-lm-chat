// src/utils/file-helpers.js
import { CONFIG } from '../config.js';

/**
 * Утилиты для работы с файлами
 */

/**
 * Читает содержимое файла как текст
 * @param {File} file - Объект файла
 * @returns {Promise<string>} Текстовое содержимое
 */
export function getFileText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Проверяет, разрешен ли тип файла
 * @param {File} file - Объект файла
 * @returns {boolean}
 */
export function isFileAllowed(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (CONFIG.SECURITY.ALLOWED_EXTENSIONS.includes(ext)) return true;
    if (file.type.startsWith('text/')) return true;
    return false;
}

/**
 * Проверяет размер файла
 * @param {File} file - Объект файла
 * @param {number} maxSize - Максимальный размер в байтах
 * @returns {boolean}
 */
export function isFileSizeValid(file, maxSize = CONFIG.LIMITS.MAX_FILE_SIZE) {
    return file.size <= maxSize;
}

/**
 * Форматирует размер файла в читаемый вид
 * @param {number} bytes - Размер в байтах
 * @returns {string} Форматированный размер
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Получает расширение файла
 * @param {File|string} file - Файл или имя файла
 * @returns {string} Расширение в нижнем регистре
 */
export function getFileExtension(file) {
    const name = typeof file === 'string' ? file : file.name;
    return name.split('.').pop().toLowerCase();
}

/**
 * Проверяет, является ли файл текстовым
 * @param {File} file - Объект файла
 * @returns {boolean}
 */
export function isTextFile(file) {
    return file.type.startsWith('text/') || 
           isFileAllowed(file);
}

/**
 * Генерирует уникальное имя файла
 * @param {string} originalName - Оригинальное имя
 * @returns {string} Уникальное имя
 */
export function generateUniqueFileName(originalName) {
    const ext = getFileExtension(originalName);
    const base = originalName.replace(`.${ext}`, '');
    const timestamp = Date.now();
    return `${base}_${timestamp}.${ext}`;
}