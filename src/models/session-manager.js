// src/models/session-manager.js
import { CONFIG } from '../config.js';

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
            }
            if (!this.sessions.length) {
                this.create('Новый диалог');
            }
        } catch (error) {
            console.warn('Ошибка при загрузке данных чатов:', error);
            this.create('Новый диалог');
        }
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
        const message = { role, content: sanitized };
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
            content: `[Пропущено ${userMessages.length - 25} сообщений для экономии контекста]`
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
        return session ? (session.model? session.model: this.defaultModel) : this.defaultModel;
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
}