// src/models/session-manager.js
// ... остальной код ...

    /**
     * Подсветка синтаксиса для сообщения (синхронная, с кэшированием)
     * Используется для быстрой загрузки истории
     * Возвращает HTML с подсветкой и включает кнопки копирования
     */
    highlightMessageSync(content) {
        if (!content || typeof content !== 'string') return content;
        
        // Проверяем, есть ли блоки кода
        const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        let lastIndex = 0;
        const parts = [];
        
        while ((match = codeRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: content.substring(lastIndex, match.index)
                });
            }
            
            const language = match[1] || 'text';
            const code = match[2];
            
            // Используем синхронную подсветку с кэшированием
            let highlighted;
            try {
                highlighted = syntaxHighlighter.highlightSync(code, language);
            } catch (e) {
                // Fallback при ошибке
                const escaped = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                highlighted = `<code class="hljs language-${language}">${escaped}</code>`;
            }
            
            parts.push({
                type: 'code',
                language: language,
                content: code,
                highlighted: highlighted
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < content.length) {
            parts.push({
                type: 'text',
                content: content.substring(lastIndex)
            });
        }
        
        // Если нет блоков кода, возвращаем исходный текст
        if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text' && parts[0].content === content)) {
            return content;
        }
        
        // Собираем результат с подсветкой
        let highlightedContent = '';
        for (const part of parts) {
            if (part.type === 'text') {
                highlightedContent += part.content;
            } else if (part.type === 'code') {
                highlightedContent += part.highlighted;
            }
        }
        
        return highlightedContent;
    }

    /**
     * Получение сообщений с подсветкой синтаксиса (синхронно)
     * Используется при загрузке истории
     * Возвращает HTML с подсветкой и включает кнопки копирования
     */
    getMessagesWithHighlight() {
        const session = this.getCurrent();
        if (!session) return [];
        
        return session.messages.map(msg => {
            if (msg.role === 'assistant' && msg.content) {
                // Если есть сохранённый сырой контент, используем его для подсветки
                const rawContent = msg._rawContent || msg.content;
                
                // Проверяем, не подсвечен ли уже контент
                if (rawContent.includes('<span class="hljs-') || rawContent.includes('<code class="hljs')) {
                    // Уже подсвечен, возвращаем как есть
                    return {
                        ...msg,
                        content: rawContent,
                        _rawContent: rawContent
                    };
                }
                
                // Подсвечиваем синхронно (с кэшированием)
                const highlighted = this.highlightMessageSync(rawContent);
                
                return {
                    ...msg,
                    content: highlighted,
                    _rawContent: rawContent
                };
            }
            return msg;
        });
    }

    /**
     * Асинхронная подсветка сообщения (для новых сообщений)
     * Возвращает HTML с подсветкой и включает кнопки копирования
     */
    async highlightMessageAsync(content) {
        if (!content || typeof content !== 'string') return content;
        
        // Проверяем, есть ли блоки кода
        const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        let lastIndex = 0;
        const parts = [];
        
        while ((match = codeRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push({
                    type: 'text',
                    content: content.substring(lastIndex, match.index)
                });
            }
            
            const language = match[1] || 'text';
            const code = match[2];
            
            // Асинхронная подсветка
            try {
                const highlighted = await syntaxHighlighter.highlight(code, language);
                parts.push({
                    type: 'code',
                    language: language,
                    content: code,
                    highlighted: highlighted
                });
            } catch (e) {
                // Fallback
                const escaped = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                parts.push({
                    type: 'code',
                    language: language,
                    content: code,
                    highlighted: `<code class="hljs language-${language}">${escaped}</code>`
                });
            }
            
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < content.length) {
            parts.push({
                type: 'text',
                content: content.substring(lastIndex)
            });
        }
        
        if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
            return content;
        }
        
        let highlightedContent = '';
        for (const part of parts) {
            if (part.type === 'text') {
                highlightedContent += part.content;
            } else if (part.type === 'code') {
                highlightedContent += part.highlighted;
            }
        }
        
        return highlightedContent;
    }

// ... остальной код ...