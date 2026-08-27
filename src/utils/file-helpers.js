// src/utils/file-helpers.js
/**
 * Утилиты для работы с файлами
  * Добавлено в 5.2: поддержка DOCX через mammoth, обработка .doc
 */
/* Изменено в 5.3 — добавлена поддержка PDF через динамический импорт */

import { CONFIG } from '../config.js';

// Глобальный объект mammoth (подключается через скрипт)
const mammoth = window.mammoth;

/* Добавлено в 5.3 */
export async function readPDFAsText(file) {
    try {
        const pdfjsLib = await import('/src/components/pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/src/components/pdf.worker.min.mjs';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    } catch (error) {
        console.error('Ошибка чтения PDF:', error);
        throw new Error(`Не удалось прочитать PDF: ${error.message}`);
    }
}

/**
 * Читает содержимое файла как текст.
 * Для DOCX использует mammoth.js для извлечения текста.
 * Для текстовых файлов использует FileReader.
 * Для DOC выбрасывает ошибку.
 * @param {File} file - Объект файла (файл для чтения)
 * @returns {Promise<string>} Текстовое содержимое (текст файла)
 */
export async function readFileAsText(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const type = file.type;

    // Проверка на PDF
    if (ext === '.pdf' || type === 'application/pdf') {
        return readPDFAsText(file);
    }

    // Проверка на DOCX
    if (ext === '.docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        if (!mammoth) {
            throw new Error('Библиотека mammoth не загружена');
        }
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value; // извлечённый текст
        } catch (error) {
            throw new Error(`Не удалось прочитать DOCX: ${error.message}`);
        }
    }

    // Проверка на DOC (старый бинарный формат)
    if (ext === '.doc' || type === 'application/msword') {
        throw new Error('Формат .doc не поддерживается. Пожалуйста, конвертируйте файл в .docx или используйте текстовый формат.');
    }

    // Для всех остальных файлов используем FileReader (текстовые)
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));
        reader.readAsText(file);
    });
}

/**
 * Проверяет, разрешён ли файл для загрузки
 * (дополнено поддержкой .docx)
 * @param {File} file - Объект файла
 * @returns {boolean}
 */
export function isFileAllowed(file) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const allowed = CONFIG.SECURITY.ALLOWED_EXTENSIONS;
    return allowed.includes(ext) || file.type.startsWith('text/');
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
    /*
    return file.name.split('.').pop().toLowerCase();
    */
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