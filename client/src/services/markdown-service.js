// src/services/markdown-service.js
/**
 * Сервис для рендеринга Markdown в безопасный HTML
 * Добавлено в 5.2.
 */
import { CONFIG } from '../config.js';

// Глобальные объекты библиотек (подключаются через скрипты)
const marked = window.marked;
const DOMPurify = window.DOMPurify;
const hljs = window.hljs;

class MarkdownService {
    constructor() {
        this.enabled = CONFIG.MARKDOWN?.ENABLED !== false;
        this.init();
    }

    init() {
        if (!this.enabled) return;

        /*
        // Проверка наличия библиотек
        if (!marked) {
            console.warn('Marked library not loaded, Markdown rendering disabled');
            return;
        }
        */
       
        // Настройка marked
        if (marked) {
            marked.setOptions({
                gfm: true,
                breaks: true,
                highlight: (code, lang) => {
                    // Используем highlight.js, если доступен, иначе возвращаем код как есть
                    try {
                        // Проверяем, загружен ли hljs
                        if (hljs) {
                        // Если язык не указан, используем автоопределение или 'text'
                        const language = lang || 'text';
                        const result = hljs.highlight(code, { language });
                            return result.value;
                        } else {
                            // fallback: экранируем и оборачиваем в <code>
                            // Fallback: экранируем код
                            const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            return `<code>${escaped}</code>`;
                        }
                    } catch (e) {
                        console.warn('Ошибка подсветки кода в Markdown:', e);
                        // Fallback при ошибке
                        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<code>${escaped}</code>`;
                    }
                }
            });
        } else {
            console.warn('Marked library not loaded, Markdown rendering disabled');
        }

        // Настройка DOMPurify (безопасность)
        if (DOMPurify) {
            DOMPurify.setConfig({
                ALLOWED_TAGS: [
                    'p', 'br', 'strong', 'em', 'u', 's', 'strike', 'del', 'ins',
                    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3',
                    'h4', 'h5', 'h6', 'hr', 'a', 'img', 'table', 'thead', 'tbody',
                    'tr', 'td', 'th', 'div', 'span', 'section', 'article', 'header', 'footer'
                ],
                ALLOWED_ATTR: [
                    'href', 'target', 'rel', 'alt', 'src', 'width', 'height',
                    'class', 'id', 'style'
                ],
                ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                ADD_ATTR: ['target'],
            });
        } else {
            console.warn('DOMPurify library not loaded, HTML sanitization disabled');
        }

        console.log('✅ MarkdownService инициализирован');
    }

    /**
     * Рендеринг Markdown-текста в безопасный HTML
     * @param {string} markdown - текст в формате Markdown
     * @returns {string} - безопасный HTML
     */
    render(markdown) {
        if (!this.enabled || !markdown) {
            // Если Markdown отключен, просто экранируем и заменяем переносы
            return this.escapeAndBreak(markdown || '');
        }

        try {
            // Если marked не загружен, используем fallback
            if (!marked) {
                return this.escapeAndBreak(markdown);
            }

            const rawHtml = marked.parse(markdown);
            // Если DOMPurify не загружен, возвращаем как есть (но это небезопасно)
            if (!DOMPurify) {
                console.warn('DOMPurify not loaded, skipping sanitization');
                return rawHtml;
            }
            //return DOMPurify.sanitize(rawHtml);
            // ... рендеринг            
            const cleanHtml = DOMPurify.sanitize(rawHtml);    
            // Создаём временный контейнер, применяем подсветку, возвращаем HTML
            if (hljs) {
                const temp = document.createElement('div');
                temp.innerHTML = cleanHtml;
                temp.querySelectorAll('pre code').forEach((block) => {
                    if (!block.classList.contains('hljs')) {
                        try {
                            const lang = block.className.replace('language-', '') || 'text';
                            const result = hljs.highlight(block.textContent, { language: lang });
                            block.innerHTML = result.value;
                            block.classList.add('hljs');
                        } catch (e) {}
                    }
                });
                return temp.innerHTML;
            }
            return cleanHtml;                    
        } catch (e) {
            console.warn('Ошибка рендеринга Markdown:', e);
            return this.escapeAndBreak(markdown);
        }
    }

    /**
     * Fallback: экранирование HTML и замена переносов строк
     */
    escapeAndBreak(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }
}

// Экспортируем синглтон
export const markdownService = new MarkdownService();