// src/models/multi-user-manager.js (обновленная версия с HTTP + SignalR)
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';
import { LongPollingClient } from '../services/long-polling-client.js';
import { deepEqual } from '../utils/string-helpers.js';


/**
 * Управление многопользовательским режимом через Long Polling
 */
export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = new ChatApiClient();
        this.localUser = this.loadUser();
        this.peers = new Map();
        this.isHost = false;
        this.roomId = null;
        //Убираем симуляцию пользователей
        //this.simulateUsers();
        this.roomName = null;
        this.messages = [];
        this.messageCount = 0;        
        // Клиенты

        //this.api = new ChatApiClient();
        this.polling = new LongPollingClient(eventBus);
        
        // Состояние
        this.isConnected = false;
        this.isPolling = false;   
        this.pollingTimer = null;   
        this.typingTimers = new Map();                  
        this.connectionMode = 'offline'; // 'offline' | 'polling' | 'signalr'
        this.lastSyncTime = Date.now();
        this.syncInterval = null;
        this.pendingMessages = [];
        this.messageCallbacks = new Set();
        this.userCallbacks = new Set();
        this.typingCallbacks = new Set();

        this.privateChats = [];
        this.heartbeatInterval = null;
        this.unreadCount = 0;
        this.setupHeartbeat();

        // Подписка на события
        this.setupEventListeners();
    }

    setupHeartbeat() {
        // Отправляем heartbeat каждые 30 секунд
        this.heartbeatInterval = setInterval(async () => {
            if (this.isConnected && this.roomId) {
                try {
                    await this.api.heartbeat({
                        userId: this.localUser.id
                    });
                } catch (error) {
                    console.warn('Heartbeat error:', error);
                }
            }
        }, 30000);
    }

    /**
     * Получение приватных чатов пользователя
     */
    async loadPrivateChats() {
        try {
            const result = await this.api.getUserChats(this.localUser.id);
            if (result.success) {
                
                if (!deepEqual(this.privateChats, result.chats))
                {
                    this.privateChats = result.chats || [];
                    this.eventBus?.emit('private:chats_updated', this.privateChats);
                }
                return this.privateChats;
            }
        } catch (error) {
            console.error('Ошибка загрузки приватных чатов:', error);
        }
        return [];
    }

    /**
     * Получение непрочитанных сообщений
     */
    async getUnreadCount() {
        try {
            const result = await this.api.getUnreadCount(this.localUser.id);
            if (result.success) {
                this.unreadCount = result.unread || 0;
                this.eventBus?.emit('private:unread_updated', this.unreadCount);
                return this.unreadCount;
            }
        } catch (error) {
            console.error('Ошибка получения непрочитанных:', error);
        }
        return 0;
    }

    /**
     * Открытие приватного чата с пользователем
     */
    async openPrivateChat(user) {
        if (!user || user.id === this.localUser.id) {
            this.app?.toast.warning('Нельзя открыть чат с самим собой');
            return null;
        }

        try {
            // Создаем или получаем чат
            const result = await this.api.createPrivateChat({
                user1Id: this.localUser.id,
                user2Id: user.id
            });

            if (result.success) {
                this.eventBus?.emit('private:chat_opened', {
                    chatId: result.chatId,
                    user: user
                });
                return result.chatId;
            }
        } catch (error) {
            console.error('Ошибка открытия чата:', error);
            this.app?.toast.error('Не удалось открыть чат');
        }
        return null;
    }

    /**
     * Получение списка пользователей для приватного чата
     */
    getAvailableUsers() {
        // Все пользователи, кроме себя
        return Array.from(this.peers.values())
            .filter(p => p.online);
    }
        
    loadUser() {
        const stored = localStorage.getItem('user_profile');
        //if (stored) return JSON.parse(stored);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Ошибка загрузки профиля:', e);
            }
        }        

        const user = {
            //Убираем симуляцию пользователей
            //id: crypto.randomUUID ? crypto.randomUUID() : 'user_' + Math.random().toString(36).slice(2, 8),
            /*
            id: this.generateUserId(),            
            name: 'User_' + Math.random().toString(36).slice(2, 6),
            avatar: ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸'][Math.floor(Math.random() * 8)],
            color: ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4'][Math.floor(Math.random() * 6)],
            lastSeen: Date.now()
            */
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

        this.eventBus.on('users:updated', (users) => {
            this.updateUsers(users);
        });        
    }

    simulateUsers() {
        if (!CONFIG.MULTI_USER.SIMULATED_USERS) return;

        const names = ['Анна', 'Петр', 'Мария', 'Иван', 'Елена'];
        const avatars = ['👩‍💻', '👨‍💻', '👩‍🔬', '👨‍🎨', '👩‍🏫'];
        const colors = ['#4caf50', '#9b4dca', '#ff69b4', '#ff9800', '#f0db4f'];

        for (let i = 0; i < CONFIG.MULTI_USER.USER_COUNT; i++) {
            const peer = {
                id: 'peer_' + i,
                name: names[i] || 'User_' + i,
                avatar: avatars[i] || '👤',
                color: colors[i] || '#888',
                online: true,
                typing: false,
                lastSeen: Date.now()
            };
            this.peers.set(peer.id, peer);
        }
        this.renderUsers();
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

            //this.startSync();

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
            //const result = await this.api.getRooms();
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
                //user: this.localUser
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
                
                // Запускаем polling
                //this.polling.start(roomId);
                
                //this.eventBus?.emit('room:joined', { roomId, users: result.users });
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
            
            //this.polling.stop();
            //this.stopSync();
            
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
            // Пытаемся отправить через API
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
            //this.pendingMessages.push(localMessage);
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
                // Обновляем локальное сообщение
                /*
                const msg = this.messages.find(m => m.Id === messageId);
                if (msg) {
                    msg.Content = newContent;
                    msg.IsEdited = true;
                    this.eventBus?.emit('message:edited', msg);
                }
                    */
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
                //this.messages = this.messages.filter(m => m.Id !== messageId);
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
        // Отправляем через SignalR если доступен, или сохраняем локально

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
        if(this.peers == users) return;
        this.peers.clear();
        /*
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
*/

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
        /*
        if (message.UserId === this.localUser.id) {
            // Убираем статус pending
            const pending = this.pendingMessages.find(m => m.Id === message.Id);
            if (pending) {
                pending._pending = false;
            }
            return;
        }
        */
        if (message.userId === this.localUser.id) {
            return;
        }

        // Добавляем в историю
        /*
        if (!this.messages.some(m => m.Id === message.Id)) {
            this.messages.push(message);
            this.eventBus?.emit('chat:message', message);
        }
            */
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
            //messageCount: this.messages.length,
            pendingMessages: this.pendingMessages.length,            
            messageCount: this.messageCount,      
            isPolling: this.isPolling,                  
            //lastSyncTime: this.lastSyncTime
            lastSyncTime: Date.now()            
        };
    }

    addPeer(peer) {
        this.peers.set(peer.id, peer);
        this.renderUsers();
        if (this.eventBus) {
            this.eventBus.emit('peer:joined', peer);
        }
    }

    removePeer(id) {
        this.peers.delete(id);
        this.renderUsers();
        if (this.eventBus) {
            this.eventBus.emit('peer:left', id);
        }
    }

    setPeerTyping(id, isTyping) {
        const peer = this.peers.get(id);
        if (peer) {
            peer.typing = isTyping;
            this.renderUsers();
            if (isTyping) {
                this.showTypingNotification(peer);
            }
        }
    }

    showTypingNotification(peer) {
        const notif = document.getElementById('typingNotification');
        if (notif) {
            notif.textContent = `${peer.avatar} ${peer.name} печатает...`;
            setTimeout(() => {
                if (notif.textContent.includes(peer.name)) {
                    notif.textContent = '';
                }
            }, 3000);
        }
    }

    getUserCount() {
        return this.peers.size + 1; // +1 для локального пользователя
    }

    /**
     * Рендеринг пользователей в UI
     */    
    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');
        const collabBar = document.getElementById('collaborationBar');

        if (!container) return;

        // Сайдбар
        //let html = `<span class="user-badge self"><span class="user-avatar">${this.localUser.avatar}</span> ${this.sanitizeHTML(this.localUser.name)} (Вы)</span>`;
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
                /*
                html += `<span class="user-badge ${peer.typing ? 'typing' : ''}" style="border-color:${peer.color};">
                        <span class="user-avatar">${peer.avatar}</span> ${this.sanitizeHTML(peer.name)}
                        ${peer.typing ? '<span class="user-status">печатает...</span>' : ''}
                    </span>`;
                    */
                   /*
                html += `<span class="user-badge ${peer.typing ? 'typing' : ''}" style="border-color:${peer.color};">
                    <span class="user-avatar">${peer.avatar}</span> 
                    ${this.sanitizeHTML(peer.name)}
                    ${peer.typing ? '<span class="user-status">печатает...</span>' : ''}
                </span>`;        
                */           
            }
        });
        container.innerHTML = html;

        // Обновляем коллаборационный бар
        //if (collabBar && this.peers.size > 0) {
        //    collabBar.classList.add('active');
            if (collabContainer) {
                let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.color};" title="Вы">${this.localUser.avatar}</span>`;
                this.peers.forEach(peer => {
                    if (peer.online) {
                        collabHtml += `<span class="collab-user-dot ${peer.isTyping ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;                        
                        //collabHtml += `<span class="collab-user-dot ${peer.typing ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                    }
                });
                collabContainer.innerHTML = collabHtml;
            }
       // } else if (collabBar) {
       //     collabBar.classList.remove('active');
       // }

        // Обновляем share модалку если открыта
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            let shareHtml = `<span class="active-user-badge">${this.localUser.avatar} ${this.sanitizeHTML(this.localUser.name)} (Вы)</span>`;
            this.peers.forEach(peer => {
                shareHtml += `<span class="active-user-badge">${peer.avatar} ${this.sanitizeHTML(peer.name)}</span>`;
            });
            activeUsersEl.innerHTML = shareHtml;
        }
    }



    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    startSimulation() {
        setInterval(() => {
            const peers = Array.from(this.peers.values()).filter(p => p.online);
            if (peers.length > 0) {
                const randomPeer = peers[Math.floor(Math.random() * peers.length)];
                this.setPeerTyping(randomPeer.id, Math.random() > 0.7);
            }
        }, 5000);
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