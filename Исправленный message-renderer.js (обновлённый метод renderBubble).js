// src/ui/renderers/message-renderer.js
// ... остальной код ...

    renderBubble(role, content, files, ragSources, isEdit, replyTo) {
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

        // Основное содержимое
        if (role === 'bot' && typeof content === 'string' && content) {
            // Проверяем, не содержит ли контент уже HTML-разметку подсветки
            // Ищем как span.hljs-* так и pre.hljs-pre
            const hasHighlighting = content.includes('<span class="hljs-') || 
                                    content.includes('<code class="hljs') ||
                                    content.includes('class="hljs-pre"');
            
            if (hasHighlighting) {
                // Контент уже подсвечен (с pre или без), вставляем как есть
                const wrapper = document.createElement('div');
                wrapper.innerHTML = content;
                bubble.appendChild(wrapper);
                
                // Если есть pre без кнопок копирования - добавляем их
                // Но обычно они уже есть, если использовался highlightMessageSync
                this.ensureCopyButtons(wrapper);
            } else {
                // Контент не подсвечен, разбираем на части и подсвечиваем асинхронно
                const parts = this.formatMessage(content);
                const container = document.createElement('div');
                container.dataset.parts = 'pending';
                
                // Для каждой части создаём элемент
                for (const p of parts) {
                    if (p.type === 'text') {
                        const textDiv = document.createElement('div');
                        const textContent = p.content || '...';
                        textDiv.innerHTML = sanitizeHTML(textContent).replace(/\n/g, '<br>');
                        container.appendChild(textDiv);
                    } else if (p.type === 'code') {
                        // Создаём pre с placeholder
                        const pre = document.createElement('pre');
                        pre.setAttribute('tabindex', '0');
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
            const td = document.createElement('div');
            td.textContent = typeof content === 'string' ? content : JSON.stringify(content);
            bubble.appendChild(td);
        }

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

        return bubble;
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
                pre.dataset.highlighting = 'done';
                
            } catch (error) {
                console.warn('Ошибка подсветки кода:', error);
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

// ... остальной код ...