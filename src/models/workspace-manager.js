// src/models/workspace-manager.js
/* Добавлено в 5.3 */

/**
 * Менеджер рабочих пространств (Workspaces)
 * Хранит список пространств, каждое из которых содержит список комнат и приватных чатов.
 * Данные сохраняются в localStorage.
 */
export class WorkspaceManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.workspaces = [];
        this.currentWorkspaceId = null;
        this.loadFromStorage();
    }

    /**
     * Загружает данные из localStorage
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem('workspaces');
            if (data) {
                const parsed = JSON.parse(data);
                this.workspaces = parsed.workspaces || [];
                this.currentWorkspaceId = parsed.currentWorkspaceId || null;
            }
        } catch (e) {
            console.warn('Ошибка загрузки рабочих пространств', e);
        }
        if (this.workspaces.length === 0) {
            // Создаём рабочее пространство по умолчанию
            this.createWorkspace('Личное');
        }
        this.saveToStorage();
    }

    /**
     * Сохраняет данные в localStorage
     */
    saveToStorage() {
        localStorage.setItem('workspaces', JSON.stringify({
            workspaces: this.workspaces,
            currentWorkspaceId: this.currentWorkspaceId
        }));
    }

    /**
     * Создаёт новое рабочее пространство
     * @param {string} name - Название пространства
     * @returns {Object} Созданное пространство
     */
    createWorkspace(name) {
        const newWorkspace = {
            id: 'ws_' + Date.now().toString(36),
            name: name || 'Новое пространство',
            rooms: [],          // массив ID комнат или объектов
            privateChats: []    // массив ID приватных чатов
        };
        this.workspaces.push(newWorkspace);
        this.currentWorkspaceId = newWorkspace.id;
        this.saveToStorage();
        this.eventBus?.emit('workspace:created', newWorkspace);
        return newWorkspace;
    }

    /**
     * Переключает текущее рабочее пространство
     * @param {string} id - ID пространства
     * @returns {boolean} Успех операции
     */
    switchWorkspace(id) {
        const ws = this.workspaces.find(w => w.id === id);
        if (ws) {
            this.currentWorkspaceId = id;
            this.saveToStorage();
            this.eventBus?.emit('workspace:switched', ws);
            return true;
        }
        return false;
    }

    /**
     * Возвращает текущее рабочее пространство
     * @returns {Object}
     */
    getCurrentWorkspace() {
        return this.workspaces.find(w => w.id === this.currentWorkspaceId) || this.workspaces[0];
    }

    /**
     * Возвращает все пространства
     * @returns {Array}
     */
    getAllWorkspaces() {
        return this.workspaces;
    }

    /**
     * Удаляет рабочее пространство
     * @param {string} id - ID пространства
     * @returns {boolean} Успех операции
     */
    deleteWorkspace(id) {
        if (this.workspaces.length <= 1) {
            this.eventBus?.emit('toast:warning', 'Нельзя удалить последнее пространство');
            return false;
        }
        this.workspaces = this.workspaces.filter(w => w.id !== id);
        if (this.currentWorkspaceId === id) {
            this.currentWorkspaceId = this.workspaces[0].id;
        }
        this.saveToStorage();
        this.eventBus?.emit('workspace:deleted', id);
        return true;
    }

    // === Методы для управления комнатами и чатами внутри workspace ===

    /**
     * Добавляет комнату в указанное пространство
     * @param {string} workspaceId - ID пространства
     * @param {Object} roomData - Данные комнаты
     */
    addRoomToWorkspace(workspaceId, roomData) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (ws) {
            // Проверяем, нет ли уже такой комнаты
            if (!ws.rooms.some(r => r.id === roomData.id)) {
                ws.rooms.push(roomData);
                this.saveToStorage();
                this.eventBus?.emit('workspace:room_added', { workspaceId, roomData });
            }
        }
    }

    /**
     * Удаляет комнату из пространства
     * @param {string} workspaceId - ID пространства
     * @param {string} roomId - ID комнаты
     */
    removeRoomFromWorkspace(workspaceId, roomId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (ws) {
            ws.rooms = ws.rooms.filter(r => r.id !== roomId);
            this.saveToStorage();
            this.eventBus?.emit('workspace:room_removed', { workspaceId, roomId });
        }
    }

    /**
     * Добавляет приватный чат в пространство
     */
    addPrivateChatToWorkspace(workspaceId, chatData) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (ws) {
            if (!ws.privateChats.some(c => c.id === chatData.id)) {
                ws.privateChats.push(chatData);
                this.saveToStorage();
                this.eventBus?.emit('workspace:chat_added', { workspaceId, chatData });
            }
        }
    }

    /**
     * Удаляет приватный чат из пространства
     */
    removePrivateChatFromWorkspace(workspaceId, chatId) {
        const ws = this.workspaces.find(w => w.id === workspaceId);
        if (ws) {
            ws.privateChats = ws.privateChats.filter(c => c.id !== chatId);
            this.saveToStorage();
            this.eventBus?.emit('workspace:chat_removed', { workspaceId, chatId });
        }
    }
}