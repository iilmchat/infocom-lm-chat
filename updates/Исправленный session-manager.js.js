// src/models/session-manager.js
import { CONFIG } from '../config.js';
import { syntaxHighlighter } from '../services/syntax-highlighter.js';

/**
 * Управление диалогами (сессиями чата)
 */
export class SessionManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sessions = [];
        this.currentId = null;
        this.defaultModel = 'local-model';
        this.load();
    }
   
    load() {
        try {
            const storedData = localStorage.getItem('chat_sessions_v5');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                this.sessions = parsedData.sessions || [];
                this.currentId = parsedData.currentId || null;

                // Обновляем сообщения в сессиях для поддержки подсветки синтаксиса
                this.upgradeSessions();
            }
            if (!this.sessions.length) {
                this.create('Новый диалог');
            }
        } catch (error) {
            console.warn('Ошибка при загрузке данных чатов:', error);
            this.create('Новый диалог');
        }
    }

    /**
     * Обновление сессий для поддержки подсветки синтаксиса
     */
    upgradeSessions() {
        let needsSave = false;
        
        for (const session of this.sessions) {
            if (session.messages) {
                for (const message of session.messages) {
                    if (message.role === 'assistant' && message.content) {
                        // Проверяем, есть ли в сообщении блоки кода
                        const codeBlocks = this.extractCodeBlocks(message.content);
                        if (codeBlocks.length > 0) {
                            // Сохраняем оригинальное содержимое, если ещё не сохранено
                            if (!message._rawContent) {
                                message._rawContent = message.content;
                                needsSave = true;
                            }
                        }
                    }
                }
            }
        }
        
        if (needsSave) {
            this.save();
        }
    }

    /**
     * Извлечение блоков кода из текста
     */
    extractCodeBlocks(content) {
        const blocks = [];
        const regex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2]
            });
        }
        return blocks;
    }

    /**
     * Создание HTML для блока кода с подсветкой и кнопкой копирования
     */
    createCodeBlockHTML(code, language) {
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
        
        // Создаём полную структуру с pre и кнопкой копирования
        // Используем data-атрибуты для идентификации
        return `<pre class="hljs-pre" data-language="${language}" data-has-copy="true">
    ${highlighted}
    <button class="copy-btn" aria-label="Копировать код">📋 Копировать</button>
</pre>`;
    }

    /**
     * Подсветка синтаксиса для сообщения (синхронная, с кэшированием)
     * Возвращает HTML с полной структурой (pre + code + кнопка копирования)
     */
    highlightMessageSync(content) {
        if (!content || typeof content !== 'string') return content;
        
        // Проверяем, есть ли блоки кода
        const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        let lastIndex = 0;
        const parts = [];
        
        while ((match = codeRegex.exec(content)) !== null) {
            // Добавляем текст до блока кода
            if (match.index > lastIndex) {
                const textContent = content.substring(lastIndex, match.index);
                if (textContent) {
                    parts.push({
                        type: 'text',
                        content: textContent
                    });
                }
            }
            
            // Добавляем блок кода с полной структурой
            const language = match[1] || 'text';
            const code = match[2];
            
            // Создаём полный HTML для блока кода
            const codeBlockHTML = this.createCodeBlockHTML(code, language);
            
            parts.push({
                type: 'code',
                language: language,
                content: code,
                html: codeBlockHTML
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        // Добавляем оставшийся текст
        if (lastIndex < content.length) {
            const textContent = content.substring(lastIndex);
            if (textContent) {
                parts.push({
                    type: 'text',
                    content: textContent
                });
            }
        }
        
        // Если нет блоков кода, возвращаем исходный текст
        if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text' && parts[0].content === content)) {
            return content;
        }
        
        // Собираем результат с полной структурой
        let result = '';
        for (const part of parts) {
            if (part.type === 'text') {
                result += part.content;
            } else if (part.type === 'code') {
                result += part.html;
            }
        }
        
        return result;
    }

    /**
     * Получение сообщений с подсветкой синтаксиса (синхронно)
     * Используется при загрузке истории
     * Возвращает HTML с полной структурой (pre + code + кнопка копирования)
     */
    getMessagesWithHighlight() {
        const session = this.getCurrent();
        if (!session) return [];
        
        return session.messages.map(msg => {
            if (msg.role === 'assistant' && msg.content) {
                // Если есть сохранённый сырой контент, используем его для подсветки
                const rawContent = msg._rawContent || msg.content;
                
                // Проверяем, не подсвечен ли уже контент и содержит ли он pre теги
                if (rawContent.includes('<span class="hljs-') || rawContent.includes('<code class="hljs')) {
                    // Проверяем, есть ли уже pre обёртка
                    if (rawContent.includes('<pre') && rawContent.includes('class="hljs-pre"')) {
                        // Уже имеет полную структуру, возвращаем как есть
                        return {
                            ...msg,
                            content: rawContent,
                            _rawContent: rawContent
                        };
                    }
                    
                    // Частично подсвечен, но без pre - нужно обновить
                    // Пересоздаём структуру с pre и кнопкой
                    const highlighted = this.highlightMessageSync(rawContent);
                    return {
                        ...msg,
                        content: highlighted,
                        _rawContent: rawContent
                    };
                }
                
                // Полная подсветка с pre и кнопкой
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
     * Возвращает HTML с полной структурой (pre + code + кнопка копирования)
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
            let highlighted;
            try {
                highlighted = await syntaxHighlighter.highlight(code, language);
            } catch (e) {
                const escaped = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                highlighted = `<code class="hljs language-${language}">${escaped}</code>`;
            }
            
            // Создаём полную структуру с pre и кнопкой
            const codeBlockHTML = `<pre class="hljs-pre" data-language="${language}" data-has-copy="true">
    ${highlighted}
    <button class="copy-btn" aria-label="Копировать код">📋 Копировать</button>
</pre>`;
            
            parts.push({
                type: 'code',
                language: language,
                content: code,
                html: codeBlockHTML
            });
            
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
        
        let result = '';
        for (const part of parts) {
            if (part.type === 'text') {
                result += part.content;
            } else if (part.type === 'code') {
                result += part.html;
            }
        }
        
        return result;
    }

    save() {
        try {
            const dataToSave = {
                sessions: this.sessions,
                currentId: this.currentId
            };
            localStorage.setItem('chat_sessions_v5', JSON.stringify(dataToSave));
            if (this.eventBus) {
                this.eventBus.emit('sessions:updated');
            }
        } catch (error) {
            console.error('Ошибка при сохранении сессий чата:', error);
        }
    }

    create(name, model = null) {
        const modelName = model || (typeof currentModel !== 'undefined' ? currentModel : this.defaultModel);
        const session = {
            id: Date.now(),
            name: name || 'Новый диалог',
            messages: [
                {
                    role: 'system',
                    content: CONFIG.SYSTEM_PROMPT
                }
            ],
            created: new Date().toISOString(),
            model: modelName,
            ragData: null,
            messageCount: 0
        };

        this.sessions.push(session);
        this.currentId = session.id;
        this.save();

        if (this.eventBus) {
            this.eventBus.emit('session:created', session);
        }

        return session;
    }

    getCurrent() {
        const currentSession = this.sessions.find(s => s.id === this.currentId);
        return currentSession || this.sessions[0];
    }

    getMessages() {
        const session = this.getCurrent();
        return session ? session.messages : [];
    }

    setMessages(messages) {
        const session = this.getCurrent();
        if (session) {
            session.messages = messages;
            this.save();
        }
    }

    addMessage(role, content, replyTo = null) {
        const session = this.getCurrent();
        if (!session) return;

        const sanitized = this.sanitizeMessage(content);
        const message = { 
            role, 
            content: sanitized,
            _rawContent: content // Сохраняем оригинал для возможной переподсветки
        };
        if (replyTo) {
            message.replyTo = replyTo;
        }

        session.messages.push(message);

        if (role === 'user') {
            session.messageCount = (session.messageCount || 0) + 1;
        }

        if (session.messages.length > CONFIG.LIMITS.MAX_MESSAGES_KEEP + 5) {
            this.compressSession(session);
        }

        const userMessages = session.messages.filter(m => m.role === 'user');
        if (userMessages.length === 1) {
            const firstMessageContent = userMessages[0].content.trim().replace(/\n/g, ' ');
            session.name = firstMessageContent.length > 30
                ? this.sanitizeHTML(firstMessageContent.substring(0, 30)) + '...'
                : this.sanitizeHTML(firstMessageContent) || 'Новый диалог';
        }

        this.save();
        if (this.eventBus) {
            this.eventBus.emit('message:added', { role, content, replyTo });
        }
    }

    compressSession(session) {
        const systemMessages = session.messages.filter(m => m.role === 'system');
        const userMessages = session.messages.filter(m => m.role !== 'system');

        if (userMessages.length <= CONFIG.LIMITS.MAX_MESSAGES_KEEP) {
            return;
        }

        const firstMessages = userMessages.slice(0, 5);
        const lastMessages = userMessages.slice(-20);
        const summaryMessage = {
            role: 'assistant',
            content: `[Пропущено ${userMessages.length - 25} сообщений для экономии контекста]`,
            _rawContent: `[Пропущено ${userMessages.length - 25} сообщений для экономии контекста]`
        };

        session.messages = [
            ...systemMessages,
            ...firstMessages,
            summaryMessage,
            ...lastMessages
        ];
    }

    switch(id) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            this.currentId = id;
            this.save();
            if (this.eventBus) {
                this.eventBus.emit('session:switched', session);
            }
            return true;
        }
        return false;
    }

    delete(id) {
        if (this.sessions.length <= 1) {
            if (this.eventBus) {
                this.eventBus.emit('toast:warning', 'Нельзя удалить последний диалог');
            }
            return false;
        }

        this.sessions = this.sessions.filter(s => s.id !== id);
        if (this.currentId === id) {
            this.currentId = this.sessions[0].id;
        }
        this.save();
        if (this.eventBus) {
            this.eventBus.emit('session:deleted', id);
        }
        return true;
    }

    rename(id, name) {
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            session.name = this.sanitizeHTML(name);
            this.save();
            if (this.eventBus) {
                this.eventBus.emit('session:renamed', { id, name: session.name });
            }
            return true;
        }
        return false;
    }

    getRAG() {
        const session = this.getCurrent();
        return session ? session.ragData : null;
    }

    setRAG(data) {
        const session = this.getCurrent();
        if (session) {
            session.ragData = data;
            this.save();
        }
    }

    getModelForChat(id = null) {
        const session = id ? this.sessions.find(s => s.id === id) : this.getCurrent();
        return session ? (session.model ? session.model : this.defaultModel) : this.defaultModel;
    }

    setModelForChat(model, id = null) {
        const session = id ? this.sessions.find(s => s.id === id) : this.getCurrent();
        if (session) {
            session.model = model;
            this.save();
            return true;
        }
        return false;
    }

    getMessageCount() {
        const session = this.getCurrent();
        return session ? (session.messageCount || 0) : 0;
    }

    getAllSessions() {
        return [...this.sessions];
    }

    sanitizeMessage(content) {
        const div = document.createElement('div');
        div.textContent = content;
        return div.innerHTML;
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Очистка сессий с удалением старых
     */
    cleanup(maxSessions = 50) {
        if (this.sessions.length <= maxSessions) return;
        
        const sorted = [...this.sessions].sort((a, b) => {
            return new Date(b.created) - new Date(a.created);
        });
        
        const keep = sorted.slice(0, maxSessions);
        const toRemove = sorted.slice(maxSessions);
        
        const currentInKeep = keep.some(s => s.id === this.currentId);
        if (!currentInKeep) {
            this.currentId = keep[0].id;
        }
        
        this.sessions = keep;
        this.save();
        
        return toRemove.length;
    }
}