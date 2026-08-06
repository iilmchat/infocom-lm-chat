// src/models/assistant-manager.js

/**
 * Управление ассистентами (встроенными и кастомными)
 */
export class AssistantManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.assistants = new Map();
        this.activeAssistant = null;
        this.loadBuiltIn();
        this.loadCustom();
    }

    loadBuiltIn() {
        const builtIn = [
            { id: 'general-programmer', name: '💻 Программист', icon: '💻', description: 'Универсальный', color: '#7ec8e3', systemPrompt: 'Ты — опытный full-stack разработчик. Отвечай на русском. Пиши чистый код с комментариями.' },
            { id: 'sql-master', name: '🗄️ SQL Мастер', icon: '🗄️', description: 'Базы данных', color: '#4caf50', systemPrompt: 'Ты — DBA эксперт. Специализация: MSSQL, PostgreSQL, MySQL. Пиши оптимальные запросы.' },
            { id: 'csharp-guru', name: '🔷 C# Гуру', icon: '🔷', description: '.NET, ASP.NET', color: '#9b4dca', systemPrompt: 'Ты — Senior C# разработчик. Экспертиза: .NET 8, ASP.NET Core, LINQ.' },
            { id: 'js-ts-ninja', name: '🟨 JS/TS Ниндзя', icon: '🟨', description: 'JavaScript/TypeScript', color: '#f0db4f', systemPrompt: 'Ты — Senior JS/TS разработчик. Node.js, React, TypeScript strict mode.' },
            { id: 'angular-architect', name: '🅰️ Angular Архитектор', icon: '🅰️', description: 'Angular 17+, RxJS', color: '#dd0031', systemPrompt: 'Ты — Angular Architect. Standalone components, signals, NgRx.' },
            { id: 'pythonista', name: '🐍 Pythonista', icon: '🐍', description: 'Python, Django, ML', color: '#3776ab', systemPrompt: 'Ты — Senior Python разработчик. FastAPI, pandas, type hints.' },
            { id: 'soul-companion', name: '💫 Для души', icon: '💫', description: 'Общение', color: '#ff69b4', systemPrompt: 'Ты — добрый собеседник. Поддержи, расскажи историю, пошути. Используй эмодзи 🌟' }
        ];
        builtIn.forEach(a => this.assistants.set(a.id, a));
    }

    loadCustom() {
        try {
            const saved = localStorage.getItem('custom_assistants');
            if (saved) {
                const custom = JSON.parse(saved);
                custom.forEach(a => this.assistants.set(a.id, a));
            }
        } catch (e) {
            console.warn('Ошибка загрузки кастомных ассистентов:', e);
        }
    }

    saveCustom() {
        try {
            const custom = Array.from(this.assistants.values()).filter(a => a.custom);
            localStorage.setItem('custom_assistants', JSON.stringify(custom));
        } catch (e) {
            console.warn('Ошибка сохранения кастомных ассистентов:', e);
        }
    }

    addCustom(name, icon, description, color, systemPrompt) {
        const id = 'custom_' + Date.now();
        const assistant = {
            id,
            name,
            icon: icon || '🤖',
            description: description || '',
            color: color || '#7ec8e3',
            systemPrompt,
            custom: true
        };
        this.assistants.set(id, assistant);
        this.saveCustom();
        
        if (this.eventBus) {
            this.eventBus.emit('assistant:created', assistant);
        }
        
        return assistant;
    }

    removeCustom(id) {
        const assistant = this.assistants.get(id);
        if (!assistant || !assistant.custom) return false;
        
        if (this.activeAssistant?.id === id) {
            this.deactivate();
        }
        
        this.assistants.delete(id);
        this.saveCustom();
        
        if (this.eventBus) {
            this.eventBus.emit('assistant:deleted', id);
        }
        
        return true;
    }

    activate(id) {
        const assistant = this.assistants.get(id);
        if (!assistant) return false;
        
        this.activeAssistant = assistant;
        
        if (this.eventBus) {
            this.eventBus.emit('assistant:activated', assistant);
        }
        
        return true;
    }

    deactivate() {
        this.activeAssistant = null;
        
        if (this.eventBus) {
            this.eventBus.emit('assistant:deactivated');
        }
    }

    getPrompt() {
        return this.activeAssistant?.systemPrompt || '';
    }

    getAll() {
        return Array.from(this.assistants.values());
    }

    get(id) {
        return this.assistants.get(id);
    }
}