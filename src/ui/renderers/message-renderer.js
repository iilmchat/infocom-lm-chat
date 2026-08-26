// src/ui/renderers/message-renderer.js
import { sanitizeHTML } from '../../services/sanitizer.js';
//Возможно надо удалить с 5.2
import { syntaxHighlighter } from '../../services/syntax-highlighter.js';
import { copyToClipboard, addCopyButtonsToCodeBlocks } from '../../utils/dom-helpers.js';

/**
 * Рендеринг сообщений чата
 * Изменено в 5.1: добавлены вложения с кнопками скачивания и удаления
 * Изменено в 5.2: используется markdownService для рендеринга Markdown и подсветки кода
 */
export class MessageRenderer {
    constructor() {
        // markdownService будет передан извне
    }    
    
    render(msgData, markdownService) {
        const { role, content, messageId, files, ragSources, isEdit, replyTo } = msgData;
        const div = document.createElement('div');
        div.className = `message ${role}`;
        if (messageId) div.dataset.messageId = messageId;
        div.setAttribute('role', 'article');
        div.setAttribute('aria-label', `${role === 'user' ? 'Ваше сообщение' : 'Ответ ассистента'}`);

        // Метка
        const label = this.renderLabel(role);
        div.appendChild(label);

        // Баббл
        //const bubble = this.renderBubble(role, content, files, ragSources, isEdit, replyTo);
        const bubble = this.renderBubble(role, content, files, ragSources, isEdit, replyTo, markdownService);
        div.appendChild(bubble);

        return div;
    }

    renderLabel(role) {
        const label = document.createElement('div');
        label.className = 'label';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = role === 'user' ? '👤 Вы' : '💻 Infocom_LM_Chat';
        label.appendChild(nameSpan);

        const actions = document.createElement('span');
        actions.className = 'message-actions';
        actions.setAttribute('role', 'toolbar');
        actions.setAttribute('aria-label', 'Действия с сообщением');

        // Кнопка редактирования (только для пользователя)
        if (role === 'user') {
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.title = 'Редактировать';
            editBtn.setAttribute('aria-label', 'Редактировать сообщение');
            editBtn.onclick = (e) => {
                e.stopPropagation();
                // Передаём управление в ChatView
                const messageDiv = e.target.closest('.message');
                if (messageDiv && window.app?.chatView) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    window.app.chatView.startEditing(messageDiv, content);
                }
            };
            actions.appendChild(editBtn);
        }

        // Кнопка ответа (для всех сообщений)
        const replyBtn = document.createElement('button');
        replyBtn.textContent = '↩️';
        replyBtn.title = 'Ответить на это сообщение';
        replyBtn.setAttribute('aria-label', 'Ответить на это сообщение');
        replyBtn.onclick = (e) => {
            e.stopPropagation();
            const messageDiv = e.target.closest('.message');
            if (messageDiv && window.app) {
                const content = messageDiv.querySelector('.bubble')?.textContent || '';
                const role = messageDiv.classList.contains('user') ? 'user' : 'bot';
                window.app.setReplyTarget(messageDiv, content, role);
            }
        };
        actions.appendChild(replyBtn);

        // Кнопка перегенерации (только для бота)
        if ((role === 'bot' || role === 'assistant')) {
            const regenBtn = document.createElement('button');
            regenBtn.textContent = '↻';
            regenBtn.title = 'Перегенерировать';
            regenBtn.setAttribute('aria-label', 'Перегенерировать ответ');
            regenBtn.onclick = (e) => {
                e.stopPropagation();
                const messageDiv = e.target.closest('.message');
                if (messageDiv && window.app?.chatView) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    window.app.chatView.regenerateMessage(messageDiv, content);
                }
            };
            actions.appendChild(regenBtn);
        }

        label.appendChild(actions);
        return label;
    }

    /**
     * Рендеринг баббла с вложениями
     * Изменено в 5.1: добавлены вложения с кнопками скачивания и удаления
     */
    renderBubble(role, content, files, ragSources, isEdit, replyTo, markdownService) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        // Контекст ответа
        if (replyTo) {
            const ctx = document.createElement('div');
            ctx.className = 'reply-context';
            const author = replyTo.role === 'user' ? 'Вы' : 'Infocom_LM_Chat';
            const preview = replyTo.content && replyTo.content.length > 100 ? 
                replyTo.content.substring(0, 100) + '...' : 
                replyTo.content || '';
            ctx.innerHTML = `<span class="reply-author">↩️ ${sanitizeHTML(author)}</span>: ${sanitizeHTML(preview)}`;
            bubble.appendChild(ctx);
        }

        // Основное содержимое – рендерим через markdownService
        if (content && typeof content === 'string') {
            const wrapper = document.createElement('div');
            // Если markdownService не передан, используем fallback
            if (markdownService && markdownService.render) {
                wrapper.innerHTML = markdownService.render(content);
            } else {
                // fallback: просто экранируем
                const div = document.createElement('div');
                div.textContent = content;
                wrapper.innerHTML = div.innerHTML.replace(/\n/g, '<br>');
            }
            // Добавляем кнопки копирования ко всем блокам кода
            //this.addCopyButtonsToCodeBlocks(wrapper);          
            // Добавляем кнопки копирования
            addCopyButtonsToCodeBlocks(wrapper);          
            bubble.appendChild(wrapper);
        } else {
            const td = document.createElement('div');
            td.textContent = content || '';
            bubble.appendChild(td);
        }

        /*
        // Основное содержимое УДАЛЕНО 5.2
        if ((role === 'bot' || role === 'assistant') && typeof content === 'string' && content) {
            // Проверяем, не содержит ли контент уже HTML-разметку подсветки
            // Ищем как span.hljs-* так и pre.hljs-pre
            const hasHighlighting = content.includes('<span class="hljs-') || 
                                    content.includes('<code class="hljs') ||
                                    content.includes('class="hljs-pre"');
            
            if (hasHighlighting) {
                // Контент уже подсвечен (с pre или без), вставляем как есть
                const wrapper = document.createElement('div');
                wrapper.innerHTML = content;
                // Обрабатываем переносы строк
                //МОЖЕТ и НАДО
                //wrapper.innerHTML = wrapper.innerHTML.replace(/\n/g, '<br>');
                bubble.appendChild(wrapper);
                
                // Если есть pre без кнопок копирования - добавляем их
                // Но обычно они уже есть, если использовался highlightMessageSync
                this.ensureCopyButtons(wrapper);
            } else {
                // Контент не подсвечен, разбираем на части и подсвечиваем асинхронно
                const parts = this.formatMessage(content);
                // Создаём контейнер для частей
                const container = document.createElement('div');
                container.dataset.parts = 'pending';
                
                // Для каждой части создаём элемент
                for (const p of parts) {
                    if (p.type === 'text') {
                        const textDiv = document.createElement('div');
                        // Если текст пустой, показываем плейсхолдер
                        const textContent = p.content || '...';
                        textDiv.innerHTML = sanitizeHTML(textContent).replace(/\n/g, '<br>');
                        container.appendChild(textDiv);
                    } else if (p.type === 'code') {
                        // Создаём pre с placeholder
                        const pre = document.createElement('pre');
                        pre.setAttribute('tabindex', '0');
                        // Используем async highlight
                        pre.dataset.language = p.language || 'text';                        
                        pre.dataset.code = p.content;
                        pre.dataset.highlighting = 'pending';
                        pre.className = 'hljs-pre';
                        
                        // Показываем индикатор загрузки
                        const loadingDiv = document.createElement('div');
                        loadingDiv.className = 'code-loading';
                        loadingDiv.textContent = '⏳ Подсветка кода...';
                        pre.appendChild(loadingDiv);
                        
                        container.appendChild(pre);
                    }
                }
                
                bubble.appendChild(container);
                
                // Запускаем асинхронную подсветку всех блоков кода
                this.highlightCodeBlocks(container);
            }

            // Источники RAG
            if (ragSources && ragSources.length) {
                const rd = document.createElement('div');
                rd.className = 'rag-sources';
                rd.innerHTML = `<strong>📚 Источники:</strong> ${ragSources.map(s =>
                    `<span style="background:var(--border-color);padding:2px 8px;border-radius:12px;margin:2px;">${sanitizeHTML(s.source)} (${(s.similarity * 100).toFixed(1)}%)</span>`
                ).join(' ')}`;
                bubble.appendChild(rd);
            }

            // Индикатор редактирования
            if (isEdit) {
                const ei = document.createElement('div');
                ei.className = 'edit-indicator';
                ei.textContent = '✏️ Отредактировано';
                bubble.appendChild(ei);
            }
        } else if (role === 'user' && typeof content === 'string') {
            const td = document.createElement('div');
            td.textContent = content || '';
            bubble.appendChild(td);
        } else if (content) {
            // Fallback для других случаев
            const td = document.createElement('div');
            td.textContent = typeof content === 'string' ? content : JSON.stringify(content);
            bubble.appendChild(td);
        }
        */

        // Вложения НО Почему-то оставлено в 5.2
        /*
        // Вложения
        if (files && files.length) {
            const fd = document.createElement('div');
            fd.className = 'file-attachment';
            (Array.isArray(files) ? files : [files]).forEach(f => {
                const item = document.createElement('span');
                item.className = 'file-item';
                const name = f.name || 'unknown';
                const size = f.size || 0;
                item.textContent = `📎 ${sanitizeHTML(name)} (${(size / 1024).toFixed(1)} KB)`;
                fd.appendChild(item);
            });
            bubble.appendChild(fd);
        }
        */

        /**
         * Вложения с кнопками скачивания и удаления
         * Добавлено в 5.1.
         */          
        if (files && files.length) {
            const fd = document.createElement('div');
            fd.className = 'file-attachment';
            const currentUserId = window.app?.multiUserManager?.localUser?.Id;
            const isModerator = window.app?.multiUserManager?.isModeratorUser?.() || false;
            const messageId = this.currentMessageId || null;
            
            (Array.isArray(files) ? files : [files]).forEach(f => {
                const item = document.createElement('span');
                item.className = 'file-item';
                const attachmentId = f.attachmentId || f.id;
                if (attachmentId) {
                    item.dataset.attachmentId = attachmentId;
                }
                const name = f.name || 'unknown';
                const size = f.size || 0;
                const sizeStr = size > 0 ? `(${(size / 1024).toFixed(1)} KB)` : '';
                item.textContent = `📎 ${sanitizeHTML(name)} ${sizeStr}`;
                
                // Кнопка скачивания
                if (attachmentId) {
                    item.style.cursor = 'pointer';
                    item.title = 'Скачать';
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const app = window.app;
                        if (app && app.chatView) {
                            app.chatView.downloadAttachment(attachmentId, name);
                        }
                    });
                }
                
                // Кнопка удаления (для владельца сообщения или модератора)
                const canDelete = (window.app?.chatView?.editingMessageId === messageId && currentUserId) || isModerator;
                if (canDelete && attachmentId) {
                    const delBtn = document.createElement('button');
                    delBtn.textContent = '✕';
                    delBtn.className = 'file-delete-btn';
                    delBtn.title = 'Удалить вложение';
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const app = window.app;
                        if (app && app.chatView) {
                            app.chatView.deleteAttachment(attachmentId, messageId);
                        }
                    });
                    item.appendChild(delBtn);
                }
                
                fd.appendChild(item);
            });
            bubble.appendChild(fd);
        }

        // Источники RAG (если есть)
        if (ragSources && ragSources.length) {
            const rd = document.createElement('div');
            rd.className = 'rag-sources';
            rd.innerHTML = `<strong>📚 Источники:</strong> ${ragSources.map(s =>
                `<span style="background:var(--border-color);padding:2px 8px;border-radius:12px;margin:2px;">${sanitizeHTML(s.source)} (${(s.similarity * 100).toFixed(1)}%)</span>`
            ).join(' ')}`;
            bubble.appendChild(rd);
        }

        // Индикатор редактирования
        if (isEdit) {
            const ei = document.createElement('div');
            ei.className = 'edit-indicator';
            ei.textContent = '✏️ Отредактировано';
            bubble.appendChild(ei);
        }

        return bubble;
    }

    /**
     * Добавляет кнопки копирования ко всем pre-блокам с кодом
     * @param {HTMLElement} container - контейнер, в котором искать pre
     */
    addCopyButtonsToCodeBlocks(container) {
        const pres = container.querySelectorAll('pre:not(.has-copy-btn), pre.hljs-pre:not(.has-copy-btn)');
        for (const pre of pres) {
            // Если уже есть кнопка, пропускаем
            if (pre.querySelector('.copy-btn')) continue;

            // Получаем код из pre
            let codeText = '';
            const codeEl = pre.querySelector('code');
            if (codeEl) {
                codeText = codeEl.textContent || '';
            } else {
                // Если нет code внутри, берём текст pre
                codeText = pre.textContent || '';
            }

            // Создаём кнопку копирования
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = '📋 Копировать';
            copyBtn.setAttribute('aria-label', 'Копировать код');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(codeText, () => {
                    copyBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => {
                        copyBtn.textContent = '📋 Копировать';
                    }, 2000);
                });
            });

            pre.appendChild(copyBtn);
            pre.classList.add('has-copy-btn');
            // Убедимся, что pre имеет нужный класс для стилей
            if (!pre.classList.contains('hljs-pre')) {
                pre.classList.add('hljs-pre');
            }
        }
    }

    /**
     * Убеждаемся, что у всех pre блоков есть кнопки копирования
     */
    ensureCopyButtons(container) {
        const pres = container.querySelectorAll('pre.hljs-pre:not(.has-copy-btn), pre:not(.has-copy-btn)');
        
        for (const pre of pres) {
            // Проверяем, есть ли уже кнопка
            if (pre.querySelector('.copy-btn')) {
                pre.classList.add('has-copy-btn');
                continue;
            }
            
            // Получаем код из pre
            const codeElement = pre.querySelector('code');
            const codeText = codeElement ? codeElement.textContent : (pre.dataset.code || '');
            
            // Создаём кнопку копирования
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = '📋 Копировать';
            copyBtn.setAttribute('aria-label', 'Копировать код');
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                copyToClipboard(codeText, () => {
                    copyBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => {
                        copyBtn.textContent = '📋 Копировать';
                    }, 2000);
                });
            };
            
            pre.appendChild(copyBtn);
            pre.classList.add('has-copy-btn');
            pre.classList.add('hljs-pre');
        }
    }    

    /**
     * Асинхронная подсветка всех блоков кода в контейнере
     */
    async highlightCodeBlocks(container) {
        const pres = container.querySelectorAll('pre[data-highlighting="pending"]');
        
        for (const pre of pres) {
            const code = pre.dataset.code || '';
            const language = pre.dataset.language || 'text';
            
            try {
                // Используем асинхронную подсветку с кэшированием
                const highlighted = await syntaxHighlighter.highlight(code, language);
                
                // Заменяем содержимое pre
                pre.innerHTML = highlighted;
                
                // Добавляем кнопку копирования
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = '📋 Копировать';
                copyBtn.setAttribute('aria-label', 'Копировать код');
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    const codeText = pre.querySelector('code')?.textContent || code;
                    copyToClipboard(codeText, () => {
                        copyBtn.textContent = '✅ Скопировано!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Копировать';
                        }, 2000);
                    });
                };
                pre.appendChild(copyBtn);
                pre.classList.add('has-copy-btn');
                pre.className = 'hljs-pre';                
             
                // Убираем статус загрузки
                pre.dataset.highlighting = 'done';
                
            } catch (error) {
                console.warn('Ошибка подсветки кода:', error);
                // Fallback - показать исходный код без подсветки
                const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                pre.innerHTML = `<code class="hljs language-${language}">${escaped}</code>`;
                pre.dataset.highlighting = 'error';
                pre.className = 'hljs-pre';     
                
                // Добавляем кнопку копирования даже при ошибке
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = '📋 Копировать';
                copyBtn.setAttribute('aria-label', 'Копировать код');
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    copyToClipboard(code, () => {
                        copyBtn.textContent = '✅ Скопировано!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Копировать';
                        }, 2000);
                    });
                };
                pre.appendChild(copyBtn);
                pre.classList.add('has-copy-btn');
            }
        }
    }

    /**
     * Синхронная версия для быстрого рендеринга (использует кэш)
     */
    renderCodeBlockSync(code, language) {
        try {
            // Используем синхронную версию (с кэшированием)
            return syntaxHighlighter.highlightSync(code, language);
        } catch (e) {
            console.warn('Ошибка синхронной подсветки:', e);
            const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<code class="hljs language-${language}">${escaped}</code>`;
        }
    }

    /**
     * Форматирование сообщения с разбивкой на текст и код
     * Используется в chat-view для стриминга
     */    
    formatMessage(content) {
        const parts = [];
        if (!content || typeof content !== 'string') {
            return [{ type: 'text', content: content || '' }];
        }
        
        let last = 0;
        const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;

        while ((match = codeRegex.exec(content)) !== null) {
            if (match.index > last) {
                const textContent = content.substring(last, match.index);
                if (textContent) {
                    parts.push({
                        type: 'text',
                            content: textContent
                    });
                }
            }
            parts.push({
                type: 'code',
                language: match[1] || 'text',
                content: match[2]
            });
            last = match.index + match[0].length;
        }

        if (last < content.length) {
            const textContent = content.substring(last);
            if (textContent) {
                parts.push({
                    type: 'text',
                    content: textContent
                });
            }
        }

        // Если нет частей, возвращаем весь контент как текст
        if (parts.length === 0) {
            parts.push({
                type: 'text',
                content: content
            });
        }

        return parts;
    }

    renderWelcome() {
        return this.render({
            role: 'bot',
            content: '👋 Начните новый диалог!'
        }, null);
    }
}