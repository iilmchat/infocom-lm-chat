// src/models/multi-user-manager.js
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';

/**
 * Управление многопользовательским режимом через Long Polling
 */
export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = new ChatApiClient();
        this.localUser = this.loadUser();
        this.peers = new Map();
        this.roomId = null;
        this.roomName = null;
        this.messages = [];
        this.messageCount = 0;
        this.isConnected = false;
        this.isPolling = false;
        this.pollingTimer = null;
        this.typingTimers = new Map();
        this.messageCallbacks = new Set();
        this.userCallbacks = new Set();
        this.typingCallbacks = new Set();

        this.setupEventListeners();
    }

    loadUser() {
        const stored = localStorage.getItem('user_profile');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Ошибка загрузки профиля:', e);
            }
        }

        const user = {
            id: this.generateUserId(),
            name: this.generateUserName(),
            avatar: this.generateAvatar(),
            color: this.generateColor(),
            lastSeen: Date.now(),
            status: 'online'
        };
        localStorage.setItem('user_profile', JSON.stringify(user));
        return user;
    }

    generateUserId() {
        return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }

    generateUserName() {
        const names = ['Анна', 'Петр', 'Мария', 'Иван', 'Елена', 'Алексей', 'Ольга', 'Дмитрий'];
        return names[Math.floor(Math.random() * names.length)] + '_' + Math.random().toString(36).slice(2, 4);
    }

    generateAvatar() {
        const avatars = ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐲', '🐳'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    generateColor() {
        const colors = ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4', '#ff9800', '#00bcd4'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    setupEventListeners() {
        this.eventBus.on('message:new', (message) => {
            this.handleNewMessage(message);
        });
    }

    /**
     * Подключение к серверу
     */
    async connectToServer(roomId = null) {
        try {
            // Проверяем доступность сервера
            const available = await this.checkServerAvailability();
            if (!available) {
                console.warn('Сервер недоступен, режим офлайн');
                this.isConnected = false;
                this.eventBus?.emit('server:disconnected');
                return false;
            }

            // Если указан roomId - присоединяемся
            if (roomId) {
                await this.joinRoom(roomId);
            } else {
                // Создаем новую комнату
                const result = await this.api.createRoom({
                    name: `Комната ${new Date().toLocaleString()}`,
                    createdBy: this.localUser.id
                });
                
                if (result.success) {
                    this.roomId = result.roomId;
                    await this.joinRoom(this.roomId);
                } else {
                    throw new Error('Не удалось создать комнату');
                }
            }

            this.isConnected = true;
            this.startPolling();
            this.eventBus?.emit('server:connected', { roomId: this.roomId });
            return true;

        } catch (error) {
            console.error('Ошибка подключения:', error);
            this.isConnected = false;
            this.eventBus?.emit('server:disconnected', { error: error.message });
            return false;
        }
    }

    /**
     * Проверка доступности сервера
     */
    async checkServerAvailability() {
        try {
            const result = await this.api.ping();
            return result.success === true;
        } catch {
            return false;
        }
    }

    /**
     * Вход в комнату
     */
    async joinRoom(roomId) {
        try {
            const result = await this.api.joinRoom({
                roomId: roomId,
                user: {
                    id: this.localUser.id,
                    name: this.localUser.name,
                    avatar: this.localUser.avatar,
                    color: this.localUser.color
                }
            });

            if (result.success) {
                this.roomId = roomId;
                this.roomName = result.room?.name || `Комната ${roomId}`;
                
                // Загружаем историю
                if (result.history) {
                    this.messages = result.history;
                    this.messageCount = result.history.length;
                    this.eventBus?.emit('chat:history', result.history);
                }
                
                // Обновляем список пользователей
                if (result.users) {
                    this.updateUsers(result.users);
                }
                
                this.eventBus?.emit('room:joined', { 
                    roomId, 
                    users: result.users,
                    history: result.history 
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Ошибка входа в комнату:', error);
            return false;
        }
    }

    /**
     * Выход из комнаты
     */
    async leaveRoom() {
        if (!this.roomId) return;

        try {
            await this.api.leaveRoom({
                roomId: this.roomId,
                userId: this.localUser.id
            });
            
            this.stopPolling();
            
            this.roomId = null;
            this.peers.clear();
            this.messages = [];
            this.messageCount = 0;
            this.isConnected = false;
            
            this.eventBus?.emit('room:left');
            
        } catch (error) {
            console.error('Ошибка выхода из комнаты:', error);
        }
    }

    /**
     * Отправка сообщения
     */
    async sendMessage(content, options = {}) {
        if (!this.roomId) {
            console.warn('Нет комнаты для отправки');
            return null;
        }

        if (!content || !content.trim()) return null;

        const message = {
            roomId: this.roomId,
            userId: this.localUser.id,
            userName: this.localUser.name,
            userAvatar: this.localUser.avatar,
            content: content.trim(),
            role: options.role || 'user',
            replyToId: options.replyToId || null,
            model: options.model || null,
            attachments: options.attachments || []
        };

        try {
            const result = await this.api.sendMessage(message);
            
            if (result.success) {
                const msg = result.message;
                this.messages.push(msg);
                this.messageCount = this.messages.length;
                this.eventBus?.emit('message:sent', msg);
                return msg;
            }
            
            // Если не удалось отправить — добавляем в локальный кеш
            const localMessage = {
                ...message,
                id: 'local_' + Date.now(),
                timestamp: new Date().toISOString(),
                _pending: true
            };
            this.messages.push(localMessage);
            this.messageCount = this.messages.length;
            
            this.eventBus?.emit('message:pending', localMessage);
            return localMessage;
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
            return null;
        }
    }

    /**
     * Редактирование сообщения
     */
    async editMessage(messageId, newContent) {
        if (!this.roomId) return false;

        try {
            const result = await this.api.editMessage({
                roomId: this.roomId,
                messageId: messageId,
                userId: this.localUser.id,
                newContent: newContent
            });

            if (result.success) {
                const msg = this.messages.find(m => m.id === messageId || m.Id === messageId);
                if (msg) {
                    msg.content = newContent;
                    msg.isEdited = true;
                    this.eventBus?.emit('message:edited', msg);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка редактирования:', error);
            return false;
        }
    }

    /**
     * Удаление сообщения
     */
    async deleteMessage(messageId) {
        if (!this.roomId) return false;

        try {
            const result = await this.api.deleteMessage(
                this.roomId,
                messageId,
                this.localUser.id
            );

            if (result.success) {
                this.messages = this.messages.filter(m => 
                    m.id !== messageId && m.Id !== messageId
                );
                this.messageCount = this.messages.length;
                this.eventBus?.emit('message:deleted', messageId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка удаления:', error);
            return false;
        }
    }

    /**
     * Статус печатания
     */
    setTyping(isTyping) {
        if (!this.roomId) return;

        this.localUser.isTyping = isTyping;
        
        // Отправляем статус на сервер
        this.api.setTypingStatus({
            roomId: this.roomId,
            userId: this.localUser.id,
            isTyping: isTyping
        }).catch(err => console.warn('Ошибка отправки статуса печатания:', err));

        this.eventBus?.emit('typing:status', {
            userId: this.localUser.id,
            isTyping: isTyping,
            roomId: this.roomId
        });
    }

    /**
     * Запуск Long Polling
     */
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.poll();
    }

    /**
     * Остановка Long Polling
     */
    stopPolling() {
        this.isPolling = false;
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    /**
     * Основной цикл Long Polling
     */
    async poll() {
        if (!this.isPolling || !this.roomId) return;

        try {
            const result = await this.api.poll({
                roomId: this.roomId,
                userId: this.localUser.id,
                lastMessageCount: this.messageCount,
                timeoutSeconds: CONFIG.SERVER.POLLING_TIMEOUT || 30
            });

            if (result.success) {
                // Обновляем счетчик сообщений
                if (result.messageCount !== undefined) {
                    this.messageCount = result.messageCount;
                }

                // Обрабатываем новые сообщения
                if (result.hasNewMessages && result.messages) {
                    for (const msg of result.messages) {
                        // Проверяем, не наше ли это сообщение
                        if (msg.userId !== this.localUser.id) {
                            if (!this.messages.some(m => m.id === msg.id || m.Id === msg.id)) {
                                this.messages.push(msg);
                                this.eventBus?.emit('message:new', msg);
                            }
                        }
                    }
                }

                // Обновляем список пользователей
                if (result.users) {
                    this.updateUsers(result.users);
                }

                // Обновляем статус соединения
                this.isConnected = true;
            }

        } catch (error) {
            console.warn('Ошибка Long Polling:', error);
            // При ошибке делаем паузу
            await this.delay(5000);
        }

        // Планируем следующий опрос
        if (this.isPolling) {
            this.pollingTimer = setTimeout(() => this.poll(), CONFIG.SERVER.POLLING_INTERVAL || 3000);
        }
    }

    /**
     * Обновление списка пользователей
     */
    updateUsers(users) {
        if (!users) return;

        this.peers.clear();
        users.forEach(user => {
            if (user.id !== this.localUser.id) {
                this.peers.set(user.id, {
                    id: user.id,
                    name: user.name || 'User',
                    avatar: user.avatar || '👤',
                    color: user.color || '#888',
                    isTyping: user.isTyping || false,
                    lastSeen: user.lastSeen || Date.now(),
                    online: true
                });
            }
        });

        this.renderUsers();
        this.eventBus?.emit('users:updated', this.peers);
    }

    /**
     * Обработка нового сообщения
     */
    handleNewMessage(message) {
        // Проверяем, не наше ли это сообщение
        if (message.userId === this.localUser.id) {
            return;
        }

        // Добавляем в историю
        if (!this.messages.some(m => m.id === message.id || m.Id === message.id)) {
            this.messages.push(message);
            this.messageCount = this.messages.length;
            this.eventBus?.emit('chat:message', message);
        }
    }

    /**
     * Задержка
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Получение истории сообщений
     */
    getMessages(limit = 100) {
        return this.messages.slice(-limit);
    }

    /**
     * Получение пользователей в комнате
     */
    getUsers() {
        return Array.from(this.peers.values());
    }

    /**
     * Получение статуса
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            roomId: this.roomId,
            roomName: this.roomName,
            userCount: this.peers.size + 1,
            messageCount: this.messageCount,
            isPolling: this.isPolling,
            lastSyncTime: Date.now()
        };
    }

    /**
     * Рендеринг пользователей в UI
     */
    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');

        if (!container) return;

        let html = `<span class="user-badge self">
            <span class="user-avatar">${this.localUser.avatar}</span> 
            ${this.sanitizeHTML(this.localUser.name)} (Вы)
            ${this.isConnected ? '🟢' : '⚪'}
        </span>`;
        
        this.peers.forEach(peer => {
            if (peer.online) {
                html += `<span class="user-badge ${peer.isTyping ? 'typing' : ''}" style="border-color:${peer.color};">
                    <span class="user-avatar">${peer.avatar}</span> 
                    ${this.sanitizeHTML(peer.name)}
                    ${peer.isTyping ? '<span class="user-status">печатает...</span>' : ''}
                </span>`;
            }
        });
        container.innerHTML = html;

        // Обновляем коллаборационный бар
        if (collabContainer) {
            let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.color};" title="Вы">${this.localUser.avatar}</span>`;
            this.peers.forEach(peer => {
                if (peer.online) {
                    collabHtml += `<span class="collab-user-dot ${peer.isTyping ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                }
            });
            collabContainer.innerHTML = collabHtml;
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}