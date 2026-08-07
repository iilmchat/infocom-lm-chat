// src/ui/renderers/message-renderer.js
// Добавить в конец класса MessageRenderer:

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

        if (parts.length === 0) {
            parts.push({
                type: 'text',
                content: content
            });
        }

        return parts;
    }