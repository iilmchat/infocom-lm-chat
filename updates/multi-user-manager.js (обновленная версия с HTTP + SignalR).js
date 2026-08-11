// src/models/multi-user-manager.js (обновленная версия с HTTP + SignalR)
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';
import { LongPollingClient } from '../services/long-polling-client.js';

export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.localUser = this.loadUser();
        this.peers = new Map();
        this.roomId = null;
        this.roomName = null;
        this.messages = [];
        
        // Клиенты
        this.api = new ChatApiClient();
        this.polling = new LongPollingClient(eventBus);
        
        // Состояние
        this.isConnected = false;
        this.connectionMode = 'offline'; // 'offline' | 'polling' | 'signalr'
        this.lastSyncTime = Date.now();
        this.syncInterval = null;
        this.pendingMessages = [];
        this.messageCallbacks = new Set();
        this.userCallbacks = new Set();

        // Подписка на события
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('message:new', (message) => {
            this.handleNewMessage(message);
        });

        this.eventBus.on('users:updated', (users) => {
            this.updateUsers(users);
        });
    }

    loadUser() {
        const stored = localStorage.getItem('user_profile');
        if (stored) return JSON.parse(stored);

        const user = {
            id: this.generateUserId(),
            name: 'User_' + Math.random().toString(36).slice(2, 6),
            avatar: ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸'][Math.floor(Math.random() * 8)],
            color: ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4'][Math.floor(Math.random() * 6)],
            lastSeen: Date.now()
        };
        localStorage.setItem('user_profile', JSON.stringify(user));
        return user;
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).slice(2, 10);
    }

    /**
     * Подключение к серверу через HTTP API + Polling
     */
    async connectToServer(roomId = null, connectionMode = 'polling') {
        try {
            this.connectionMode = connectionMode;
            
            // Проверяем доступность сервера
            const available = await this.checkServerAvailability();
            if (!available) {
                console.warn('Server not available, using offline mode');
                this.isConnected = false;
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
                }
            }

            this.isConnected = true;
            this.startSync();
            
            return true;
        } catch (error) {
            console.error('Connection error:', error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Проверка доступности сервера
     */
    async checkServerAvailability() {
        try {
            const result = await this.api.getRooms();
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
                user: this.localUser
            });

            if (result.success) {
                this.roomId = roomId;
                this.roomName = result.room?.name || `Комната ${roomId}`;
                
                // Загружаем историю
                if (result.history) {
                    this.messages = result.history;
                    this.eventBus?.emit('chat:history', result.history);
                }
                
                // Обновляем список пользователей
                if (result.users) {
                    this.updateUsers(result.users);
                }
                
                // Запускаем polling
                this.polling.start(roomId);
                
                this.eventBus?.emit('room:joined', { roomId, users: result.users });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Join room error:', error);
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
            
            this.polling.stop();
            this.stopSync();
            
            this.roomId = null;
            this.peers.clear();
            this.messages = [];
            this.isConnected = false;
            
            this.eventBus?.emit('room:left');
            
        } catch (error) {
            console.error('Leave room error:', error);
        }
    }

    /**
     * Отправка сообщения
     */
    async sendMessage(content, options = {}) {
        if (!this.roomId) {
            console.warn('No room to send message');
            return null;
        }

        const message = {
            roomId: this.roomId,
            userId: this.localUser.id,
            userName: this.localUser.name,
            userAvatar: this.localUser.avatar,
            content: content,
            role: options.role || 'user',
            replyToId: options.replyToId || null,
            model: options.model || null,
            attachments: options.attachments || []
        };

        try {
            // Пытаемся отправить через API
            const result = await this.api.sendMessage(message);
            
            if (result.success) {
                const msg = result.message;
                this.messages.push(msg);
                this.eventBus?.emit('message:sent', msg);
                return msg;
            }
            
            // Если не удалось отправить - добавляем в локальный кеш
            const localMessage = {
                ...message,
                Id: 'local_' + Date.now(),
                Timestamp: new Date().toISOString(),
                _pending: true
            };
            this.messages.push(localMessage);
            this.pendingMessages.push(localMessage);
            
            this.eventBus?.emit('message:pending', localMessage);
            return localMessage;
            
        } catch (error) {
            console.error('Send message error:', error);
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
                // Обновляем локальное сообщение
                const msg = this.messages.find(m => m.Id === messageId);
                if (msg) {
                    msg.Content = newContent;
                    msg.IsEdited = true;
                    this.eventBus?.emit('message:edited', msg);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Edit message error:', error);
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
                this.messages = this.messages.filter(m => m.Id !== messageId);
                this.eventBus?.emit('message:deleted', messageId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Delete message error:', error);
            return false;
        }
    }

    /**
     * Статус печатания
     */
    setTyping(isTyping) {
        // Отправляем через SignalR если доступен, или сохраняем локально
        this.eventBus?.emit('typing:status', {
            userId: this.localUser.id,
            isTyping: isTyping,
            roomId: this.roomId
        });
    }

    /**
     * Обработка нового сообщения
     */
    handleNewMessage(message) {
        // Проверяем, не наше ли это сообщение
        if (message.UserId === this.localUser.id) {
            // Убираем статус pending
            const pending = this.pendingMessages.find(m => m.Id === message.Id);
            if (pending) {
                pending._pending = false;
            }
            return;
        }

        // Добавляем в историю
        if (!this.messages.some(m => m.Id === message.Id)) {
            this.messages.push(message);
            this.eventBus?.emit('chat:message', message);
        }
    }

    /**
     * Обновление списка пользователей
     */
    updateUsers(users) {
        if (!users) return;

        this.peers.clear();
        users.forEach(user => {
            if (user.Id !== this.localUser.id) {
                this.peers.set(user.Id, {
                    id: user.Id,
                    name: user.Name || 'User',
                    avatar: user.Avatar || '👤',
                    color: user.Color || '#888',
                    online: true,
                    typing: user.IsTyping || false
                });
            }
        });

        this.renderUsers();
        this.eventBus?.emit('users:updated', this.peers);
    }

    /**
     * Синхронизация состояния
     */
    startSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (!this.isConnected || !this.roomId) return;
            
            try {
                // Синхронизация пользователей
                const roomInfo = await this.api.getRoomInfo(this.roomId);
                if (roomInfo.success) {
                    this.updateUsers(roomInfo.room?.Users);
                }

                // Синхронизация непрочитанных сообщений
                this.lastSyncTime = Date.now();
                
            } catch (error) {
                console.warn('Sync error:', error);
            }
        }, 10000); // Каждые 10 секунд
    }

    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
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
            connectionMode: this.connectionMode,
            roomId: this.roomId,
            roomName: this.roomName,
            userCount: this.peers.size + 1,
            messageCount: this.messages.length,
            pendingMessages: this.pendingMessages.length,
            lastSyncTime: this.lastSyncTime
        };
    }

    /**
     * Рендеринг пользователей
     */
    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');
        const collabBar = document.getElementById('collaborationBar');

        if (!container) return;

        let html = `<span class="user-badge self">
            <span class="user-avatar">${this.localUser.avatar}</span> 
            ${this.sanitizeHTML(this.localUser.name)} (Вы)
            ${this.isConnected ? '🟢' : '⚪'}
        </span>`;
        
        this.peers.forEach(peer => {
            if (peer.online) {
                html += `<span class="user-badge ${peer.typing ? 'typing' : ''}" style="border-color:${peer.color};">
                    <span class="user-avatar">${peer.avatar}</span> 
                    ${this.sanitizeHTML(peer.name)}
                    ${peer.typing ? '<span class="user-status">печатает...</span>' : ''}
                </span>`;
            }
        });
        container.innerHTML = html;

        // Коллаборационный бар
        if (collabBar && this.peers.size > 0) {
            collabBar.classList.add('active');
            if (collabContainer) {
                let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.color};" title="Вы">${this.localUser.avatar}</span>`;
                this.peers.forEach(peer => {
                    if (peer.online) {
                        collabHtml += `<span class="collab-user-dot ${peer.typing ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                    }
                });
                collabContainer.innerHTML = collabHtml;
            }
        } else if (collabBar) {
            collabBar.classList.remove('active');
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Автоматическое подключение при загрузке
     */
    async autoConnect() {
        // Проверяем параметр комнаты в URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            await this.connectToServer(roomId);
        } else {
            await this.connectToServer();
        }
    }

    /**
     * Отключение
     */
    disconnect() {
        this.leaveRoom();
        this.isConnected = false;
        this.connectionMode = 'offline';
    }
}