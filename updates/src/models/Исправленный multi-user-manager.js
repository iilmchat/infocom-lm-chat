// src/models/multi-user-manager.js (исправленная версия)
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';
import { LongPollingClient } from '../services/long-polling-client.js';
import { deepEqual } from '../utils/string-helpers.js';

// Константы
const COMMON_ROOM_NAME = 'Общая комната';
const COMMON_ROOM_PREFIX = 'common_';

/**
 * Управление многопользовательским режимом через Long Polling
 * 
 * Архитектура:
 * - Все пользователи подключаются к ОБЩЕЙ комнате (common room)
 * - Приватные чаты создаются как отдельные комнаты между двумя пользователями
 */
export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = new ChatApiClient();
        
        // Локальный пользователь
        this.localUser = this.loadUser();
        
        // Хранилище пользователей (пиры) в общей комнате
        this.peers = new Map();
        
        // Текущая комната (общая)
        this.roomId = null;
        this.roomName = null;
        
        // Приватные чаты
        this.privateChats = [];
        this.privateChatRooms = new Map(); // chatId -> { roomId, user1Id, user2Id }
        this.unreadCount = 0;
        
        // Состояние
        this.isConnected = false;
        this.isPolling = false;
        this.pollingTimer = null;
        this.typingTimers = new Map();
        this.connectionMode = 'offline';
        this.lastSyncTime = Date.now();
        this.syncInterval = null;
        this.messages = [];
        this.messageCount = 0;
        this.pendingMessages = [];
        
        // Колбэки
        this.messageCallbacks = new Set();
        this.userCallbacks = new Set();
        this.typingCallbacks = new Set();

        // Сердцебиение
        this.heartbeatInterval = null;
        this.setupHeartbeat();

        // Подписка на события
        this.setupEventListeners();
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====

    /**
     * Загрузка профиля пользователя из localStorage
     * @returns {Object} Профиль пользователя
     */
    loadUser() {
        const stored = localStorage.getItem('user_profile');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Ошибка загрузки профиля:', e);
            }
        }

        // Создание нового пользователя
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

    /**
     * Генерация ID пользователя
     * @returns {string} Уникальный ID
     */
    generateUserId() {
        return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }

    /**
     * Генерация имени пользователя
     * @returns {string} Случайное имя
     */
    generateUserName() {
        const names = ['Анна', 'Пётр', 'Мария', 'Иван', 'Елена', 'Алексей', 'Ольга', 'Дмитрий', 
                       'Екатерина', 'Сергей', 'Наталья', 'Андрей', 'Татьяна', 'Михаил', 'Юлия', 'Владимир'];
        return names[Math.floor(Math.random() * names.length)] + '_' + Math.random().toString(36).slice(2, 4);
    }

    /**
     * Генерация аватара (эмодзи)
     * @returns {string} Эмодзи-аватар
     */
    generateAvatar() {
        const avatars = ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐲', '🐳', '🐧', '🐨', '🦋', '🐙'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    /**
     * Генерация цвета (HEX)
     * @returns {string} HEX-цвет
     */
    generateColor() {
        const colors = ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4', '#ff9800', '#00bcd4',
                        '#e91e63', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ===== ПОДКЛЮЧЕНИЕ К СЕРВЕРУ =====

    /**
     * Подключение к серверу и вход в общую комнату
     * @param {string} roomId - ID комнаты (если указан, пытаемся подключиться к существующей)
     * @param {string} connectionMode - Режим подключения ('polling' | 'signalr')
     * @returns {Promise<boolean>} Успех подключения
     */
    async connectToServer(roomId = null, connectionMode = 'polling') {
        try {
            this.connectionMode = connectionMode;
            
            // 1. Проверяем доступность сервера
            const available = await this.checkServerAvailability();
            if (!available) {
                console.warn('⚠️ Сервер недоступен, режим офлайн');
                this.isConnected = false;
                this.eventBus?.emit('server:disconnected');
                return false;
            }

            // 2. Определяем ID общей комнаты
            let targetRoomId = roomId;
            
            if (!targetRoomId) {
                // Пытаемся найти общую комнату
                targetRoomId = await this.findOrCreateCommonRoom();
            }

            if (!targetRoomId) {
                console.error('❌ Не удалось найти или создать общую комнату');
                return false;
            }

            // 3. Вход в комнату
            const joinResult = await this.joinRoom(targetRoomId);
            if (!joinResult) {
                console.error('❌ Не удалось войти в комнату');
                return false;
            }

            this.roomId = targetRoomId;
            this.isConnected = true;

            // 4. Запускаем синхронизацию
            this.startPolling();
            this.eventBus?.emit('server:connected', { 
                roomId: this.roomId,
                roomName: this.roomName,
                userCount: this.peers.size + 1
            });
            
            // 5. Загружаем приватные чаты
            await this.loadPrivateChats();
            
            console.log(`✅ Подключен к общей комнате: ${this.roomName} (${this.roomId})`);
            console.log(`👥 Пользователей в комнате: ${this.peers.size + 1}`);
            
            return true;

        } catch (error) {
            console.error('❌ Ошибка подключения:', error);
            this.isConnected = false;
            this.eventBus?.emit('server:disconnected', { error: error.message });
            return false;
        }
    }

    /**
     * Поиск существующей общей комнаты или создание новой
     * @returns {Promise<string|null>} ID комнаты или null
     */
    async findOrCreateCommonRoom() {
        try {
            // 1. Получаем список всех комнат
            const roomsResult = await this.api.getRooms();
            
            if (roomsResult.success && roomsResult.rooms) {
                // 2. Ищем общую комнату
                const commonRoom = roomsResult.rooms.find(room => 
                    room.name === COMMON_ROOM_NAME || 
                    room.roomId?.startsWith(COMMON_ROOM_PREFIX) ||
                    room.id?.startsWith(COMMON_ROOM_PREFIX)
                );

                if (commonRoom) {
                    const roomId = commonRoom.roomId || commonRoom.id;
                    console.log(`🔍 Найдена общая комната: ${roomId}`);
                    return roomId;
                }
            }

            // 3. Если общей комнаты нет — создаём
            console.log('🆕 Создаём новую общую комнату...');
            const createResult = await this.api.createRoom({
                name: COMMON_ROOM_NAME,
                createdBy: this.localUser.id
            });

            if (createResult.success) {
                const newRoomId = createResult.roomId;
                console.log(`✅ Создана общая комната: ${newRoomId}`);
                return newRoomId;
            }

            console.error('❌ Не удалось создать общую комнату');
            return null;

        } catch (error) {
            console.error('❌ Ошибка поиска/создания общей комнаты:', error);
            return null;
        }
    }

    /**
     * Проверка доступности сервера
     * @returns {Promise<boolean>} Доступен ли сервер
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
     * @param {string} roomId - ID комнаты
     * @returns {Promise<boolean>} Успех входа
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
                
                // Загружаем историю сообщений
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
                    roomName: this.roomName,
                    users: result.users,
                    history: result.history 
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Ошибка входа в комнату:', error);
            return false;
        }
    }

    /**
     * Выход из комнаты
     * @returns {Promise<void>}
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
            this.roomName = null;
            this.peers.clear();
            this.messages = [];
            this.messageCount = 0;
            this.isConnected = false;
            
            this.eventBus?.emit('room:left');
            
        } catch (error) {
            console.error('❌ Ошибка выхода из комнаты:', error);
        }
    }

    /**
     * Отключение от сервера
     */
    disconnect() {
        this.leaveRoom();
        this.isConnected = false;
        this.connectionMode = 'offline';
        this.stopHeartbeat();
    }

    // ===== ОБЩАЯ КОМНАТА: СООБЩЕНИЯ =====

    /**
     * Отправка сообщения в общую комнату
     * @param {string} content - Текст сообщения
     * @param {Object} options - Дополнительные параметры
     * @returns {Promise<Object|null>} Отправленное сообщение
     */
    async sendMessage(content, options = {}) {
        if (!this.roomId) {
            console.warn('⚠️ Нет комнаты для отправки');
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
                // Проверяем, не дублируется ли сообщение
                if (!this.messages.some(m => m.id === msg.id || m.Id === msg.id)) {
                    this.messages.push(msg);
                    this.messageCount = this.messages.length;
                }
                this.eventBus?.emit('message:sent', msg);
                return msg;
            }
            
            // Если не удалось отправить — добавляем в локальный кеш как ожидающее
            const localMessage = {
                ...message,
                id: 'local_' + Date.now(),
                timestamp: new Date().toISOString(),
                _pending: true
            };
            this.messages.push(localMessage);
            this.messageCount = this.messages.length;
            this.pendingMessages.push(localMessage);
            
            this.eventBus?.emit('message:pending', localMessage);
            return localMessage;
            
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            return null;
        }
    }

    /**
     * Редактирование сообщения в общей комнате
     * @param {string} messageId - ID сообщения
     * @param {string} newContent - Новый текст
     * @returns {Promise<boolean>} Успех редактирования
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
            console.error('❌ Ошибка редактирования:', error);
            return false;
        }
    }

    /**
     * Удаление сообщения из общей комнаты
     * @param {string} messageId - ID сообщения
     * @returns {Promise<boolean>} Успех удаления
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
            console.error('❌ Ошибка удаления:', error);
            return false;
        }
    }

    // ===== СТАТУС ПЕЧАТАНИЯ =====

    /**
     * Установка статуса печатания в общей комнате
     * @param {boolean} isTyping - Печатает ли пользователь
     */
    setTyping(isTyping) {
        if (!this.roomId) return;

        this.localUser.isTyping = isTyping;
        
        // Отправляем статус на сервер
        this.api.setTypingStatus({
            roomId: this.roomId,
            userId: this.localUser.id,
            isTyping: isTyping
        }).catch(err => console.warn('⚠️ Ошибка отправки статуса печатания:', err));

        this.eventBus?.emit('typing:status', {
            userId: this.localUser.id,
            isTyping: isTyping,
            roomId: this.roomId
        });
    }

    // ===== ПОЛЬЗОВАТЕЛИ =====

    /**
     * Обновление списка пользователей в общей комнате
     * @param {Array} users - Список пользователей
     */
    updateUsers(users) {
        if (!users) return;
        
        // Проверяем, изменился ли список
        const newUserIds = new Set(users.map(u => u.id));
        const currentUserIds = new Set(this.peers.keys());
        
        // Если списки совпадают, не обновляем
        if (newUserIds.size === currentUserIds.size && 
            [...newUserIds].every(id => currentUserIds.has(id))) {
            return;
        }

        this.peers.clear();
        
        users.forEach(user => {
            // Не добавляем себя
            if (user.id !== this.localUser.id) {
                this.peers.set(user.id, {
                    id: user.id,
                    name: user.name || 'Пользователь',
                    avatar: user.avatar || '👤',
                    color: user.color || '#888',
                    isTyping: user.isTyping || false,
                    lastSeen: user.lastSeen || Date.now(),
                    online: true,
                    status: user.status || 'online'
                });
            }
        });

        this.renderUsers();
        this.eventBus?.emit('users:updated', this.peers);
    }

    /**
     * Получение списка пользователей в общей комнате
     * @returns {Array} Список пользователей
     */
    getUsers() {
        return Array.from(this.peers.values());
    }

    /**
     * Получение количества пользователей в общей комнате
     * @returns {number} Количество пользователей (включая себя)
     */
    getUserCount() {
        return this.peers.size + 1;
    }

    /**
     * Получение доступных пользователей для приватного чата
     * @returns {Array} Список доступных пользователей
     */
    getAvailableUsers() {
        return Array.from(this.peers.values())
            .filter(p => p.online !== false);
    }

    // ===== ПРИВАТНЫЕ ЧАТЫ =====

    /**
     * Создание или получение приватного чата с пользователем
     * @param {Object} user - Пользователь для чата
     * @returns {Promise<string|null>} ID чата
     */
    async openPrivateChat(user) {
        if (!user || user.id === this.localUser.id) {
            this.app?.toast.warning('Нельзя открыть чат с самим собой');
            return null;
        }

        try {
            // Проверяем, не существует ли уже чат
            const existingChat = this.privateChats.find(chat => 
                (chat.user1Id === this.localUser.id && chat.user2Id === user.id) ||
                (chat.user1Id === user.id && chat.user2Id === this.localUser.id)
            );

            if (existingChat) {
                this.eventBus?.emit('private:chat_opened', {
                    chatId: existingChat.id,
                    user: user
                });
                return existingChat.id;
            }

            // Создаём новый приватный чат
            const result = await this.api.createPrivateChat({
                user1Id: this.localUser.id,
                user2Id: user.id
            });

            if (result.success) {
                const chatId = result.chatId;
                
                // Сохраняем в список приватных чатов
                const newChat = {
                    id: chatId,
                    user1Id: this.localUser.id,
                    user2Id: user.id,
                    lastMessage: null,
                    lastMessageAt: null,
                    unreadCount: 0
                };
                this.privateChats.push(newChat);
                
                this.eventBus?.emit('private:chat_opened', {
                    chatId: chatId,
                    user: user
                });
                
                return chatId;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Ошибка открытия приватного чата:', error);
            this.app?.toast.error('Не удалось открыть чат');
            return null;
        }
    }

    /**
     * Загрузка списка приватных чатов пользователя
     * @returns {Promise<Array>} Список приватных чатов
     */
    async loadPrivateChats() {
        try {
            const result = await this.api.getUserChats(this.localUser.id);
            if (result.success) {
                if (!deepEqual(this.privateChats, result.chats)) {
                    this.privateChats = result.chats || [];
                    this.eventBus?.emit('private:chats_updated', this.privateChats);
                }
                return this.privateChats;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки приватных чатов:', error);
        }
        return [];
    }

    /**
     * Отправка сообщения в приватный чат
     * @param {string} chatId - ID чата
     * @param {string} content - Текст сообщения
     * @param {string} replyToId - ID сообщения, на которое отвечаем (опционально)
     * @returns {Promise<Object|null>} Отправленное сообщение
     */
    async sendPrivateMessage(chatId, content, replyToId = null) {
        if (!chatId || !content || !content.trim()) return null;

        // Находим получателя
        const chat = this.privateChats.find(c => c.id === chatId);
        if (!chat) {
            console.warn('⚠️ Чат не найден');
            return null;
        }

        const receiverId = chat.user1Id === this.localUser.id ? chat.user2Id : chat.user1Id;

        try {
            const result = await this.api.sendPrivateMessage({
                chatId: chatId,
                senderId: this.localUser.id,
                receiverId: receiverId,
                content: content.trim(),
                replyToId: replyToId
            });

            if (result.success) {
                const msg = result.message;
                // Обновляем последнее сообщение в чате
                chat.lastMessage = content;
                chat.lastMessageAt = new Date().toISOString();
                
                this.eventBus?.emit('private:message_sent', msg);
                return msg;
            }
            return null;
        } catch (error) {
            console.error('❌ Ошибка отправки приватного сообщения:', error);
            return null;
        }
    }

    /**
     * Получение истории приватного чата
     * @param {string} chatId - ID чата
     * @param {number} limit - Количество сообщений
     * @param {number} offset - Смещение
     * @returns {Promise<Array>} Список сообщений
     */
    async getPrivateHistory(chatId, limit = 50, offset = 0) {
        try {
            const result = await this.api.getPrivateHistory(chatId, limit, offset);
            if (result.success) {
                // Отмечаем сообщения как прочитанные
                await this.api.markPrivateRead({
                    chatId: chatId,
                    userId: this.localUser.id
                });
                return result.messages || [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки истории:', error);
        }
        return [];
    }

    /**
     * Получение количества непрочитанных сообщений
     * @returns {Promise<number>} Количество непрочитанных
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
            console.error('❌ Ошибка получения непрочитанных:', error);
        }
        return 0;
    }

    // ===== LONG POLLING =====

    /**
     * Запуск Long Polling для синхронизации
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
                // Обновляем счётчик сообщений
                if (result.messageCount !== undefined) {
                    this.messageCount = result.messageCount;
                }

                // Обрабатываем новые сообщения
                if (result.hasNewMessages && result.messages) {
                    for (const msg of result.messages) {
                        // Пропускаем свои сообщения (уже добавлены локально)
                        if (msg.userId === this.localUser.id) continue;
                        
                        // Проверяем, нет ли уже такого сообщения
                        if (!this.messages.some(m => m.id === msg.id || m.Id === msg.id)) {
                            this.messages.push(msg);
                            this.messageCount = this.messages.length;
                            this.eventBus?.emit('message:new', msg);
                        }
                    }
                }

                // Обновляем список пользователей
                if (result.users) {
                    this.updateUsers(result.users);
                }

                this.isConnected = true;
            }

        } catch (error) {
            console.warn('⚠️ Ошибка Long Polling:', error);
            // При ошибке делаем паузу
            await this.delay(5000);
        }

        // Планируем следующий опрос
        if (this.isPolling) {
            this.pollingTimer = setTimeout(() => this.poll(), CONFIG.SERVER.POLLING_INTERVAL || 3000);
        }
    }

    // ===== СЕРДЦЕБИЕНИЕ =====

    /**
     * Настройка отправки heartbeat
     */
    setupHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            if (this.isConnected && this.roomId) {
                try {
                    await this.api.heartbeat({
                        userId: this.localUser.id
                    });
                } catch (error) {
                    console.warn('⚠️ Heartbeat error:', error);
                }
            }
        }, 30000);
    }

    /**
     * Остановка heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

    /**
     * Задержка (Promise)
     * @param {number} ms - Время в миллисекундах
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Получение истории сообщений из общей комнаты
     * @param {number} limit - Количество сообщений
     * @returns {Array} Список сообщений
     */
    getMessages(limit = 100) {
        return this.messages.slice(-limit);
    }

    /**
     * Получение статуса подключения
     * @returns {Object} Статус
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            connectionMode: this.connectionMode,
            roomId: this.roomId,
            roomName: this.roomName,
            userCount: this.peers.size + 1,
            messageCount: this.messageCount,
            pendingMessages: this.pendingMessages.length,
            isPolling: this.isPolling,
            lastSyncTime: Date.now(),
            privateChatsCount: this.privateChats.length,
            unreadCount: this.unreadCount
        };
    }

    /**
     * Санитизация HTML
     * @param {string} str - Строка для санитизации
     * @returns {string} Безопасная строка
     */
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== UI РЕНДЕРИНГ =====

    /**
     * Рендеринг пользователей в UI
     */
    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');
        const collabBar = document.getElementById('collaborationBar');

        if (!container) return;

        // Сайдбар — список пользователей
        let html = `<span class="user-badge self">
            <span class="user-avatar">${this.localUser.avatar}</span> 
            ${this.sanitizeHTML(this.localUser.name)} (Вы)
            ${this.isConnected ? '🟢' : '⚪'}
        </span>`;
        
        this.peers.forEach(peer => {
            if (peer.online !== false) {
                html += `<span class="user-badge ${peer.isTyping ? 'typing' : ''}" style="border-color:${peer.color};">
                    <span class="user-avatar">${peer.avatar}</span> 
                    ${this.sanitizeHTML(peer.name)}
                    ${peer.isTyping ? '<span class="user-status">печатает...</span>' : ''}
                </span>`;
            }
        });
        container.innerHTML = html;

        // Коллаборационная панель
        if (collabBar && this.peers.size > 0) {
            collabBar.classList.add('active');
            if (collabContainer) {
                let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.color};" title="Вы">${this.localUser.avatar}</span>`;
                this.peers.forEach(peer => {
                    if (peer.online !== false) {
                        collabHtml += `<span class="collab-user-dot ${peer.isTyping ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                    }
                });
                collabContainer.innerHTML = collabHtml;
            }
        } else if (collabBar) {
            collabBar.classList.remove('active');
        }

        // Обновляем share модалку, если открыта
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            let shareHtml = `<span class="active-user-badge">${this.localUser.avatar} ${this.sanitizeHTML(this.localUser.name)} (Вы)</span>`;
            this.peers.forEach(peer => {
                if (peer.online !== false) {
                    shareHtml += `<span class="active-user-badge">${peer.avatar} ${this.sanitizeHTML(peer.name)}</span>`;
                }
            });
            activeUsersEl.innerHTML = shareHtml;
        }
    }

    /**
     * Рендеринг приватных чатов в sidebar
     */
    renderPrivateChats() {
        const container = document.getElementById('privateChatsList');
        if (!container) return;

        if (!this.privateChats || this.privateChats.length === 0) {
            container.innerHTML = `
                <div style="padding:8px 16px;font-size:11px;color:var(--text-secondary);">
                    Нет приватных чатов
                </div>
            `;
            return;
        }

        container.innerHTML = this.privateChats.map(chat => {
            const otherUserId = chat.user1Id === this.localUser.id 
                ? chat.user2Id 
                : chat.user1Id;
            
            // Получаем имя пользователя из кэша
            const peer = this.peers.get(otherUserId);
            const name = peer?.name || otherUserId;
            const avatar = peer?.avatar || '👤';
            const color = peer?.color || '#888';
            const lastMsg = chat.lastMessage || 'Нет сообщений';
            const lastMsgAt = chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString() : '';

            return `
                <div class="private-chat-item" data-user-id="${otherUserId}" data-chat-id="${chat.id}">
                    <div class="private-chat-avatar" style="color:${color};">${avatar}</div>
                    <div class="private-chat-info">
                        <div class="private-chat-name">${this.sanitizeHTML(name)}</div>
                        <div class="private-chat-last">${this.sanitizeHTML(lastMsg.substring(0, 50))}</div>
                    </div>
                    <div class="private-chat-time">${lastMsgAt}</div>
                    ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
                </div>
            `;
        }).join('');

        // Обработчики клика
        container.querySelectorAll('.private-chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const peer = this.peers.get(userId);
                if (peer) {
                    this.app?.privateChat?.open(peer);
                }
            });
        });
    }

    // ===== НАСТРОЙКА СОБЫТИЙ =====

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        this.eventBus.on('message:new', (message) => {
            this.handleNewMessage(message);
        });

        this.eventBus.on('users:updated', (users) => {
            this.updateUsers(users);
        });
    }

    /**
     * Обработка нового сообщения
     * @param {Object} message - Новое сообщение
     */
    handleNewMessage(message) {
        // Пропускаем свои сообщения
        if (message.userId === this.localUser.id) {
            return;
        }

        // Добавляем в историю, если ещё нет
        if (!this.messages.some(m => m.id === message.id || m.Id === message.id)) {
            this.messages.push(message);
            this.messageCount = this.messages.length;
            this.eventBus?.emit('chat:message', message);
        }
    }

    // ===== АВТОМАТИЧЕСКОЕ ПОДКЛЮЧЕНИЕ =====

    /**
     * Автоматическое подключение при загрузке страницы
     * @returns {Promise<boolean>} Успех подключения
     */
    async autoConnect() {
        // Проверяем параметр комнаты в URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            return await this.connectToServer(roomId);
        } else {
            return await this.connectToServer();
        }
    }
}