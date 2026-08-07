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
        if (content.includes('<span class="hljs-') || content.includes('<code class="hljs')) {
            // Контент уже подсвечен, просто вставляем
            const wrapper = document.createElement('div');
            wrapper.innerHTML = content;
            // Обрабатываем переносы строк
            wrapper.innerHTML = wrapper.innerHTML.replace(/\n/g, '<br>');
            bubble.appendChild(wrapper);
        } else {
            // Контент не подсвечен, используем обычную обработку
            const parts = this.formatMessage(content);
            parts.forEach(p => {
                if (p.type === 'text') {
                    const textDiv = document.createElement('div');
                    const textContent = p.content || '...';
                    textDiv.innerHTML = sanitizeHTML(textContent).replace(/\n/g, '<br>');
                    bubble.appendChild(textDiv);
                } else if (p.type === 'code') {
                    const pre = document.createElement('pre');
                    pre.setAttribute('tabindex', '0');
                    try {
                        const highlighted = syntaxHighlighter.highlightSync(p.content, p.language);
                        pre.innerHTML = highlighted;
                    } catch (e) {
                        const escaped = p.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        pre.innerHTML = `<code class="hljs language-${p.language || 'text'}">${escaped}</code>`;
                    }
                    
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'copy-btn';
                    copyBtn.textContent = '📋 Копировать';
                    copyBtn.setAttribute('aria-label', 'Копировать код');
                    copyBtn.onclick = () => {
                        copyToClipboard(p.content, () => {
                            copyBtn.textContent = '✅ Скопировано!';
                            setTimeout(() => {
                                copyBtn.textContent = '📋 Копировать';
                            }, 2000);
                        });
                    };
                    pre.appendChild(copyBtn);
                    bubble.appendChild(pre);
                }
            });
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