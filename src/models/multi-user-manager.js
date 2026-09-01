// src/models/multi-user-manager.js
/* Изменено в 5.3 — добавлен WorkspaceManager */
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';
import { LongPollingClient } from '../services/long-polling-client.js';
import { deepEqual } from '../utils/string-helpers.js';
import { WorkspaceManager } from './workspace-manager.js';   /* Добавлено в 5.3 */

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
    constructor(app) {
        this.app = app;        
        this.eventBus = app.eventBus;
        this.api = app.apiService;
        
        // Локальный пользователь
        this.localUser = this.loadUser();
        
        // Хранилище пользователей (пиры) в общей комнате
        this.peers = new Map();
        this.isHost = false;
        
        // Текущая комната (общая)        
        this.roomId = null;
        //Убираем симуляцию пользователей
        //this.simulateUsers();
        this.roomName = null;
  
        // Клиенты

        //this.api = new ChatApiClient();
        this.polling = new LongPollingClient(this.eventBus);
        
        this.workspaceManager = new WorkspaceManager(this.eventBus);   /* Добавлено в 5.3 */

        // Состояние
        this.isConnected = false;
        this.isPolling = false;   
        this.pollingTimer = null;   
        this.typingTimers = new Map();                  
        this.connectionMode = 'offline'; // 'offline' | 'polling' | 'signalr'
        this.lastSyncTime = Date.now();
        this.syncInterval = null;
        this.messages = [];
        this.messageCount = 0;      
        this.userRole = null; // Текущая роль пользователя      
        this.isAdmin = false;
        this.isModerator = false;    
        // Приватные чаты
        this.privateChats = [];
        this.privateChatRooms = new Map(); // chatId -> { roomId, user1Id, user2Id }
        this.unreadCount = 0;

        this.pendingMessages = [];
        
        // Колбэки
        this.messageCallbacks = new Set();
        this.userCallbacks = new Set();
        this.typingCallbacks = new Set();

        //this.privateChats = [];
        // Сердцебиение        
        this.heartbeatInterval = null;
        //this.unreadCount = 0;
        this.setupHeartbeat();

        // Подписка на события
        // Настройка обработчиков        
        this.setupEventListeners();
        this.setupAuthEvents();     

        this.setupWorkspaceEvents();   /* Добавлено в 5.3 */           
    }

    // ===== ИНИЦИАЛИЗАЦИЯ =====

    /**
     * Загрузка профиля пользователя
     * {Object} Профиль пользователя
     */   
    // Изменено в 5.1: Добавлена проверка, не используется ли уже пользователь из auth     
    loadUser() {
        // Если уже есть пользователь из сессии (установлен извне), не создаём нового
        // Проверяем наличие в localStorage
        const stored = localStorage.getItem('user_profile');
        //if (stored) return JSON.parse(stored);
        if (stored) {
            try {
                const user = JSON.parse(stored);
                // Добавляем поля для авторизации
                user.token = user.token || null;
                user.role = user.role || 'Admin';
                if(user.Id)
                    {user.id = user.Id;}
                else
                    {user.Id = user.id;}
                if(user.Name)
                    {user.name = user.Name;}
                else
                    {user.Name = user.name;}                
                if(user.Avatar)
                    {user.avatar = user.Avatar;}
                else
                    {user.Avatar = user.avatar;}                   
                if(user.Color)
                    {user.color = user.Color;}
                else
                    {user.Color = user.color;}                    
                if(user.LastSeen)
                    {user.lastSeen = user.LastSeen;}
                else
                    {user.LastSeen = user.lastSeen;}                   
                if(user.Status)
                    {user.status = user.Status;}
                else
                    {user.Status = user.status;}                                      
                if(user.Role)
                    {user.role = user.Role || 'Admin';}
                else
                    {user.Role = user.role|| 'Admin';}         
                if(user.AvatarType)
                    {user.avatarType = user.AvatarType;}
                else
                    {user.AvatarType = user.avatarType;}         
                if(user.AvatarData)
                    {user.avatarData = user.AvatarData;}
                else
                    {user.AvatarData = user.avatarData;}                                                      
                return user;
            } catch (e) {
                console.warn('Ошибка загрузки профиля:', e);
            }
        }        

        // Создание нового пользователя (только если нет сохранённого)
        // Добавлено в 5.1: Генерируем ID и сохраняем
        const user = {
            //Убираем симуляцию пользователей
            //id: crypto.randomUUID ? crypto.randomUUID() : 'user_' + Math.random().toString(36).slice(2, 8),
            /*
            id: this.generateUserId(),            
            name: 'User_' + Math.random().toString(36).slice(2, 6),
            avatar: ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐲', '🐳', '🐧', '🐨', '🦋', '🐙','👩‍💻', '👨‍💻', '👩‍🔬', '👨‍🎨', '👩‍🏫'][Math.floor(Math.random() * 8)],
            color: ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4'][Math.floor(Math.random() * 6)],
            lastSeen: Date.now()
            */
            id: this.generateUserId(),
            name: this.generateUserName(),
            avatar: this.generateAvatar(),
            color: this.generateColor(),
            /* Добавлено в 6.1: поддержка AvatarService */
            avatarType: 'emoji',
            avatarData: this.generateAvatar(),
            lastSeen: Date.now(),
            status: 'online',
            token: null,
            role: 'Admin'       
        };
        user.Id = user.id;
        user.Name = user.name;
        user.Avatar= user.avatar;
        user.Color= user.color;
        user.LastSeen= user.lastSeen;
        user.Status= user.status;
        user.Token= user.token;
        user.Role= user.role;    

        this.saveUser(user);        
        //localStorage.setItem('user_profile', JSON.stringify(user));
        return user;
    }

    /**
     * Сохранение пользователя
     */
    saveUser(user) {
        localStorage.setItem('user_profile', JSON.stringify(user));
    }

    /**
     * Обновление профиля на сервере
     */
    // Добавлено в 5.1: метод для обновления профиля на сервере    
    async updateProfile(name, avatar, color) {
        try {
            const result = await this.api.updateUserProfile({
                userId: this.localUser.Id,
                name: name,
                avatar: avatar,
                color: color,

                Name: name,
                Avatar: avatar,
                Color: color                
            });

            if (result.success) {
                this.localUser.name = name;
                this.localUser.avatar = avatar;
                this.localUser.color = color;

                this.localUser.Name = name;
                this.localUser.Avatar = avatar;
                this.localUser.Color = color;        

                this.saveUser(this.localUser);
                this.eventBus?.emit('profile:updated', this.localUser);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            return false;
        }
    }

    /**
     * Получение информации о пользователе с сервера (Пока отключено. ВКлючить)
     */
    async fetchUserInfo() {
        try {
            const result = /*this.localUser;*/await this.api.getUser(this.localUser.Id);
            if ((result.success && result.user)||this.localUser) {
                
                const userData = result.user;
                this.localUser.role = userData.role || userData.Role || 'Admin';
                this.localUser.status = userData.status || userData.Status || 'online';
                this.isAdmin = this.localUser.role === 'Admin';
                this.isModerator = this.isAdmin || this.localUser.role === 'Manager';

                this.localUser.Role = userData.role || userData.Role || 'Admin';
                this.localUser.Status = userData.status || userData.Status || 'online';
                this.IsAdmin = this.localUser.role === 'Admin';
                this.IsModerator = this.isAdmin || this.localUser.role === 'Manager';      

                this.saveUser(this.localUser);
                this.eventBus?.emit('user:info_updated', this.localUser);
                return userData;
                
                //Локальная работа
                /*
                const userData = result;
                this.localUser.role = 'Admin';
                this.localUser.status = 'online';
                this.localUser.Role = 'Admin';
                this.localUser.Status = 'online';                
                this.isAdmin = this.localUser.role === 'Admin';
                this.isModerator = this.isAdmin || this.localUser.role === 'Manager';
                this.IsAdmin = this.localUser.role === 'Admin';
                this.IsModerator = this.isAdmin || this.localUser.role === 'Manager';                
                this.saveUser(this.localUser);
                this.eventBus?.emit('user:info_updated', this.localUser);
                return userData;       
                */        
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения информации о пользователе:', error);
            return null;
        }
    }

    /**
     * Проверка прав пользователя
     */
    hasRole(requiredRole) {
        const rolePriority = {
            'Admin': 4,
            'Manager': 3,
            'User': 2,
            'Guest': 1
        };

        const userPriority = rolePriority[this.localUser.Role] || 0;
        const requiredPriority = rolePriority[requiredRole] || 0;

        return userPriority >= requiredPriority;
    }

    /**
     * Проверка, является ли пользователь администратором
     */
    isAdminUser() {
        return this.hasRole('Admin');
    }

    /**
     * Проверка, является ли пользователь модератором
     */
    isModeratorUser() {
        return this.hasRole('Manager');
    }

    /**
     * Настройка событий авторизации
     */
    setupAuthEvents() {
        // При подключении к серверу получаем информацию о пользователе
        this.eventBus.on('server:connected', async () => {
            await this.fetchUserInfo();
            this.updateAuthUI();
        });

        // Обновление роли пользователя
        this.eventBus.on('user:role_changed', (data) => {
            if (data.userId === this.localUser.Id) {
                this.localUser.role = data.newRole;
                this.isAdmin = this.localUser.role === 'Admin';
                this.isModerator = this.isAdmin || this.localUser.role === 'Manager';

                this.localUser.Role = data.newRole;
                this.IsAdmin = this.localUser.role === 'Admin';
                this.IsModerator = this.isAdmin || this.localUser.role === 'Manager';                
                this.saveUser(this.localUser);
                this.updateAuthUI();
                this.eventBus?.emit('toast:info', `Ваша роль изменена на: ${data.newRole}`);
            }
        });
    }

    /**
     * Обновление UI в зависимости от роли
     */
    updateAuthUI() {
        const adminBtn = document.getElementById('adminBtn');
        const moderatorPanel = document.getElementById('moderatorPanel');
        const userRoleDisplay = document.getElementById('userRoleDisplay');

        if (adminBtn) {
            adminBtn.style.display = this.isAdminUser() ? 'flex' : 'none';
        }

        if (moderatorPanel) {
            moderatorPanel.style.display = this.isModeratorUser() ? 'block' : 'none';
        }

        if (userRoleDisplay) {
            const roleNames = {
                'Admin': '🛡️ Администратор',
                'Manager': '🔧 Руководитель',
                'User': '👤 Пользователь',
                'Guest': '👋 Гость'
            };
            if(this.localUser.Role)
            {
                userRoleDisplay.textContent = roleNames[this.localUser.Role] || this.localUser.Role;
            }
            else
            {
                userRoleDisplay.textContent = roleNames[this.localUser.role] || this.localUser.role;
            }
        }

        // Показываем/скрываем элементы для администратора
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = this.isAdminUser() ? 'block' : 'none';
        });

        // Показываем/скрываем элементы для модератора
        document.querySelectorAll('.moderator-only').forEach(el => {
            el.style.display = this.isModeratorUser() ? 'block' : 'none';
        });
    }
    
    /**
     * Генерация ID пользователя
     * {string} Уникальный ID
     */
    generateUserId() {
        return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }

    /**
     * Генерация имени пользователя
     * {string} Случайное имя
     */
    generateUserName() {
        const names = ['Анна', 'Пётр', 'Мария', 'Иван', 'Елена', 'Алексей', 'Ольга', 'Дмитрий', 
                       'Екатерина', 'Сергей', 'Наталья', 'Андрей', 'Татьяна', 'Михаил', 'Юлия', 'Владимир'];
        return names[Math.floor(Math.random() * names.length)] + '_' + Math.random().toString(36).slice(2, 4);
    }

    /**
     * Генерация аватара (эмодзи)
     * {string} Эмодзи-аватар
     */
    generateAvatar() {
        const avatars = ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄', '🐲', '🐳', '🐧', '🐨', '🦋', '🐙','👩‍💻', '👨‍💻', '👩‍🔬', '👨‍🎨', '👩‍🏫'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    /**
     * Генерация цвета (HEX)
     *{string} HEX-цвет
     */
    generateColor() {
        const colors = ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4', '#ff9800', '#00bcd4',
                        '#e91e63', '#3f51b5', '#009688', '#ff5722', '#795548', '#607d8b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /* Удалено 5.4
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
                lastSeen: Date.now(),

                Id: 'peer_' + i,
                Name: names[i] || 'User_' + i,
                Avatar: avatars[i] || '👤',
                COMMON_ROOM_NAMEolor: colors[i] || '#888',
                Online: true,
                Typing: false,
                LastSeen: Date.now()                
            };
            this.peers.set(peer.Id, peer);
        }
        this.renderUsers();
    }
    */

    generateUserId() {
        return 'user_' + Math.random().toString(36).slice(2, 10);
    }

    // ===== ПОДКЛЮЧЕНИЕ К СЕРВЕРУ =====

    /**
     * Подключение к серверу и вход в общую комнату
     * {string} roomId - ID комнаты (если указан, пытаемся подключиться к существующей)
     * {string} connectionMode - Режим подключения ('polling' | 'signalr')
     * {Promise<boolean>} Успех подключения
     * Подключение к серверу через HTTP API + Polling
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

            /*
            //До 5.1
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
            */

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

            //this.startSync();

            // 4. Запускаем синхронизацию            
            this.startPolling();
            //this.eventBus?.emit('server:connected', { roomId: this.roomId });
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

    // 5.3 ===== Рабочие места =====
    /* Добавлено в 5.3 */
    setupWorkspaceEvents() {
        this.eventBus.on('workspace:switched', (ws) => {
            // Перезагружаем комнаты и чаты
            this.loadPrivateChats();
            this.findOrCreateCommonRoom();
            this.app?.sidebar.render();
            this.app?.chatView.loadMessages();
        });
    }

    /**
     * Поиск существующей общей комнаты или создание новой
     * {Promise<string|null>} ID комнаты или null
     */
    // 5.3 В методе findOrCreateCommonRoom можно использовать текущий workspace    
    async findOrCreateCommonRoom() {
        // Добавлено 5.3 (Начало)
        const currentWs = this.workspaceManager.getCurrentWorkspace();
        // Здесь можно искать комнату в текущем workspace, либо использовать общий ID
        // Например, если в workspace хранится ID общей комнаты:
        // const commonRoomId = currentWs.commonRoomId;
        // ...
        // Создаём новую и сохраняем в workspace, если её нет        
        // Добавлено 5.3 (Окончание)
        try {
            // 1. Получаем список всех комнат
            const roomsResult = await this.api.getRooms();
            
            if (roomsResult.success && roomsResult.rooms) {
                // 2. Ищем общую комнату
                const commonRoom = roomsResult.rooms.find(room => 
                    room.Name === COMMON_ROOM_NAME || 
                    room.RoomId?.startsWith(COMMON_ROOM_PREFIX) ||
                    room.Id?.startsWith(COMMON_ROOM_PREFIX)||
                    room.id?.startsWith(COMMON_ROOM_PREFIX)
                );

                if (commonRoom) {
                    const roomId = commonRoom.RoomId || commonRoom.Id || commonRoom.id;
                    console.log(`🔍 Найдена общая комната: ${roomId}`);
                    return roomId;
                }
            }

            // 3. Если общей комнаты нет — создаём
            console.log('🆕 Создаём новую общую комнату...');
            const createResult = await this.api.createRoom({
                name: COMMON_ROOM_NAME,
                createdBy: this.localUser.Id
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
     * {Promise<boolean>} Доступен ли сервер
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
     * {string} roomId - ID комнаты
     * {Promise<boolean>} Успех входа
     */
    async joinRoom(roomId) {
        try {
            const result = await this.api.joinRoom({
                roomId: roomId,
                //user: this.localUser
                user: {
                    id: this.localUser.Id,
                    name: this.localUser.Name,
                    avatar: this.localUser.Avatar,
                    color: this.localUser.Color,

                    Id: this.localUser.Id,
                    Name: this.localUser.Name,
                    Avatar: this.localUser.Avatar,
                    Color: this.localUser.Color,                   
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
                
                // Запускаем polling
                //this.polling.start(roomId);
                
                //this.eventBus?.emit('room:joined', { roomId, users: result.users });
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
     * {Promise<void>}
     */
    async leaveRoom() {
        if (!this.roomId) return;

        try {
            await this.api.leaveRoom({
                roomId: this.roomId,
                userId: this.localUser.Id
            });
            
            //this.polling.stop();
            //this.stopSync();
            
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
     * {string} content - Текст сообщения
     * {Object} options - Дополнительные параметры
     * {Promise<Object|null>} Отправленное сообщение
     */
    async sendMessage(content, options = {}) {
        if (!this.roomId) {
            console.warn('⚠️ Нет комнаты для отправки');
            return null;
        }

        if (!content || !content.trim()) return null;

        const message = {
            roomId: this.roomId,
            userId: this.localUser.Id,
            userName: this.localUser.Name,
            userAvatar: this.localUser.Avatar,
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
                // Проверяем, не дублируется ли сообщение
                if (!this.messages.some(m => m.id === msg.id || m.Id === msg.id)) 
                {
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
            //this.pendingMessages.push(localMessage);
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
     * {string} messageId - ID сообщения
     * {string} newContent - Новый текст
     * {Promise<boolean>} Успех редактирования
     */
    async editMessage(messageId, newContent) {
        if (!this.roomId) return false;

        try {
            const result = await this.api.editMessage({
                roomId: this.roomId,
                messageId: messageId,
                userId: this.localUser.Id,
                newContent: newContent
            });

            if (result.success) {
                // Обновляем локальное сообщение УБРАНО в 5.1
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
            console.error('❌ Ошибка редактирования:', error);
            return false;
        }
    }

    /**
     * Удаление сообщения из общей комнаты
     * {string} messageId - ID сообщения
     * {Promise<boolean>} Успех удаления
     */
    async deleteMessage(messageId) {
        if (!this.roomId) return false;

        try {
            const result = await this.api.deleteMessage(
                this.roomId,
                messageId,
                this.localUser.Id
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
            console.error('❌ Ошибка удаления:', error);
            return false;
        }
    }

    // ===== СТАТУС ПЕЧАТАНИЯ =====

    /**
     * Установка статуса печатания в общей комнате
     * {boolean} isTyping - Печатает ли пользователь
     */
    setTyping(isTyping) {
        // Отправляем через SignalR если доступен, или сохраняем локально

        if (!this.roomId) return;

        this.localUser.isTyping = isTyping;
        this.localUser.IsTyping = isTyping;        
        
        // Отправляем статус на сервер
        this.api.setTypingStatus({
            roomId: this.roomId,
            userId: this.localUser.Id,
            isTyping: isTyping
        }).catch(err => console.warn('⚠️ Ошибка отправки статуса печатания:', err));

        this.eventBus?.emit('typing:status', {
            userId: this.localUser.Id,
            isTyping: isTyping,
            roomId: this.roomId
        });
    }

    // ===== ПОЛЬЗОВАТЕЛИ =====

    /**
     * Обновление списка пользователей в общей комнате
     * {Array} users - Список пользователей
     */
    updateUsers(users) {
        if (!users) return;
        let userList = Array.isArray(users) ? users : Array.from(users.values());//Object.values(users);
        // Проверяем, изменился ли список
        const newUserIds = new Set(userList.map(u => u.Id));
        const currentUserIds = new Set(this.peers.keys());
        
        // Если списки совпадают, не обновляем
        if (newUserIds.size === currentUserIds.size && 
            [...newUserIds].every(Id => currentUserIds.has(Id))) {
            return;
        }

        this.peers.clear();

        userList.forEach(user => {
            // Не добавляем себя
            if (user.Id !== this.localUser.Id) {
                this.peers.set(user.Id, {
                    id: user.Id,
                    name: user.Name || 'Пользователь',
                    avatar: user.Avatar || '👤',
                    color: user.Color || '#888',
                    isTyping: user.IsTyping || false,
                    lastSeen: user.LastSeen || Date.now(),
                    online: true,
                    status: user.Status || 'online',

                    Id: user.Id,
                    Name: user.Name || 'Пользователь',
                    Avatar: user.Avatar || '👤',
                    Color: user.Color || '#888',
                    IsTyping: user.IsTyping || false,
                    LastSeen: user.LastSeen || Date.now(),
                    Online: true,
                    Status: user.Status || 'online'                    
                });
            }
        });

        this.renderUsers();
        this.eventBus?.emit('users:updated', this.peers);
    }
     
    /**
     * Получение списка пользователей в общей комнате
     * {Array} Список пользователей
     */
    getUsers() {
        return Array.from(this.peers.values());
    }

    /**
     * Получение количества пользователей в общей комнате
     * {number} Количество пользователей (включая себя)
     */
    getUserCount() {
        // +1 для локального пользователя
        return this.peers.size + 1;         
    }
    
   /**
     * Получение доступных пользователей для приватного чата
     * {Array} Список доступных пользователей
     */
    getAvailableUsers() {
        // Все пользователи, кроме себя
        return Array.from(this.peers.values())
            .filter(p => p.Online !== false);
    }   

    // ===== ПРИВАТНЫЕ ЧАТЫ =====
    
    /**
     * Создание или получение приватного чата с пользователем
     * {Object} user - Пользователь для чата
     * {Promise<string|null>} ID чата
     */
    async openPrivateChat(user) {
        if (!user || user.Id === this.localUser.Id) {
            this.app?.toast.warning('Нельзя открыть чат с самим собой');
            return null;
        }

        try {
            // Проверяем, не существует ли уже чат
            const existingChat = this.privateChats.find(chat => 
                (chat.user1Id === this.localUser.Id && chat.user2Id === user.Id) ||
                (chat.user1Id === user.Id && chat.user2Id === this.localUser.Id)
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
                user1Id: this.localUser.Id,
                user2Id: user.Id
            });

            if (result.success) {
                const chatId = result.chatId;
                
                // Сохраняем в список приватных чатов
                const newChat = {
                    id: chatId,
                    user1Id: this.localUser.Id,
                    user2Id: user.Id,
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
     * {Promise<Array>} Список приватных чатов
     */
    // 5.3 В loadPrivateChats можно загружать чаты, сохранённые в workspace    
    async loadPrivateChats() {
        try {
            const result = await this.api.getUserChats(this.localUser.Id);
            if (result.success) {
                //Новое сравнение массивов
                if (!deepEqual(this.privateChats, result.chats)) 
                {
                    this.privateChats = result.chats || [];
                    this.eventBus?.emit('private:chats_updated', this.privateChats);
                }

                // Добавлено 5.3 (Начало)
                // После загрузки сохраняем в текущий workspace
                const currentWs = this.workspaceManager.getCurrentWorkspace();
                currentWs.privateChats = this.privateChats;
                this.workspaceManager.saveToStorage();    
                // Добавлено 5.3 (Окончание)

                return this.privateChats;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки приватных чатов:', error);
        }
        return [];
    }

    /**
     * Отправка сообщения в приватный чат
     * {string} chatId - ID чата
     * {string} content - Текст сообщения
     * {string} replyToId - ID сообщения, на которое отвечаем (опционально)
     * {Promise<Object|null>} Отправленное сообщение
     */
    async sendPrivateMessage(chatId, content, replyToId = null) {
        if (!chatId || !content || !content.trim()) return null;

        // Находим получателя
        const chat = this.privateChats.find(c => c.id === chatId);
        if (!chat) {
            console.warn('⚠️ Чат не найден');
            return null;
        }

        const receiverId = chat.user1Id === this.localUser.Id ? chat.user2Id : chat.user1Id;

        try {
            const result = await this.api.sendPrivateMessage({
                chatId: chatId,
                senderId: this.localUser.Id,
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
     * {string} chatId - ID чата
     * {number} limit - Количество сообщений
     * {number} offset - Смещение
     * {Promise<Array>} Список сообщений
     */
    async getPrivateHistory(chatId, limit = 50, offset = 0) {
        try {
            const result = await this.api.getPrivateHistory(chatId, limit, offset);
            if (result.success) {
                // Отмечаем сообщения как прочитанные
                await this.api.markPrivateRead({
                    chatId: chatId,
                    userId: this.localUser.Id
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
     * {Promise<number>} Количество непрочитанных
     */
    async getUnreadCount() {
        try {
            const result = await this.api.getUnreadCount(this.localUser.Id);
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
                userId: this.localUser.Id,
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
                        if (msg.userId === this.localUser.Id) continue;
                        
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

                // Обновляем статус соединения
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
        // Отправляем heartbeat каждые 30 секунд
        this.heartbeatInterval = setInterval(async () => {
            if (this.isConnected && this.roomId) {
                try {
                    await this.api.heartbeat({
                        userId: this.localUser.Id
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
     * {number} ms - Время в миллисекундах
     * {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Синхронизация состояния Устарело в 5.1
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

    //Устарело в 5.1
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Получение истории сообщений из общей комнаты
     * {number} limit - Количество сообщений
     * {Array} Список сообщений
     */
    getMessages(limit = 100) {
        return this.messages.slice(-limit);
    }

    /**
     * Получение статуса подключения
     * {Object} Статус
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
     * {string} str - Строка для санитизации
     * {string} Безопасная строка
     */
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    addPeer(peer) {
        this.peers.set(peer.Id, peer);
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
            peer.Typing = isTyping;            
            this.renderUsers();
            if (isTyping) {
                this.showTypingNotification(peer);
            }
        }
    }

    showTypingNotification(peer) {
        const notif = document.getElementById('typingNotification');
        if (notif) {
            notif.textContent = `${peer.Avatar} ${peer.Name} печатает...`;
            setTimeout(() => {
                if (notif.textContent.includes(peer.Name)) {
                    notif.textContent = '';
                }
            }, 3000);
        }
    }

    // ===== UI РЕНДЕРИНГ =====

    /**
     * Рендеринг пользователей в UI
     */    
    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');
        const collabBar = document.getElementById('collaborationBar');
        const avatarHTML = this.app.avatarService.getAvatarHTML(this.app.multiUserManager.localUser);        
        const avatarPeerHTML = this.app.avatarService.getAvatarPeerHTML(this.app.multiUserManager.localUser);        

        
        if (!container) return;

        // Сайдбар — список пользователей       

        let html = `<span class="user-badge self">
            ${avatarHTML} 
            ${this.sanitizeHTML(this.app.multiUserManager.localUser.Name)} (Вы)
            ${this.app.multiUserManager.isConnected ? '🟢' : '⚪'}
        </span>`;       
        /* 6.0.1
        let html = `<span class="user-badge self">
            <span class="user-avatar">${this.localUser.Avatar}</span> 
            ${this.sanitizeHTML(this.localUser.Name)} (Вы)
            ${this.isConnected ? '🟢' : '⚪'}
        </span>`;
        */    

        this.app.multiUserManager.peers.forEach(peer => {
            if (peer.Online !== false) {
                const peerAvatar = this.app.avatarService.getAvatarHTML(peer);
                html += `<span class="user-badge ${peer.IsTyping ? 'typing' : ''}" style="border-color:${peer.Color};">
                    ${peerAvatar} 
                    ${this.sanitizeHTML(peer.Name)}
                    ${peer.IsTyping ? '<span class="user-status">печатает...</span>' : ''}
                </span>`;
            }
        });
        container.innerHTML = html;

        // Коллаборационная панель
        //if (collabBar && this.peers.size > 0) {
        //    collabBar.classList.add('active');
        if (collabBar && this.peers.size > 0) {
            collabBar.classList.add('active');        
            if (collabContainer) {
                //let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.Color};" title="Вы">${this.localUser.Avatar}</span>`;
                let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.Color};" title="Вы">${avatarPeerHTML}</span>`;
                this.peers.forEach(peer => {
                    if (peer.Online) {
                        const peerAvatar1 = this.app.avatarService.getAvatarPeerHTML(peer);                        
                        collabHtml += `<span class="collab-user-dot ${peer.IsTyping ? 'typing' : ''}" style="background:${peer.Color};" title="${this.sanitizeHTML(peer.Name)}">${peerAvatar1}</span>`;                        
                        //collabHtml += `<span class="collab-user-dot ${peer.typing ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                    }
                });
                collabContainer.innerHTML = collabHtml;
            }
       // } else if (collabBar) {
       //     collabBar.classList.remove('active');
       // }
        } else if (collabBar) {
            collabBar.classList.remove('active');
        }

        // Обновляем share модалку, если открыта
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            let shareHtml = `<span class="active-user-badge">${this.localUser.Avatar} ${this.sanitizeHTML(this.localUser.Name)} (Вы)</span>`;
            this.peers.forEach(peer => {
                if (peer.Online !== false) 
                {
                    shareHtml += `<span class="active-user-badge">${peer.Avatar} ${this.sanitizeHTML(peer.Name)}</span>`;
                }
            });
            activeUsersEl.innerHTML = shareHtml;
        }
    }

    /**
     * Рендеринг приватных чатов в sidebar
     */
// ... в renderPrivateChats    
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
            const otherUserId = chat.user1Id === this.localUser.Id 
                ? chat.user2Id 
                : chat.user1Id;
            
            // Получаем имя пользователя из кэша
            const peer = this.peers.get(otherUserId);
            const name = peer?.Name || otherUserId;
            const avatar = peer?.Avatar || '👤';
            const peerAvatar = this.app.avatarService.getAvatarHTML({ 
                        name: name, 
                        avatarType: peer?.avatarType, 
                        avatarData: peer?.avatarData,
                        color: peer?.Color || '#888'
                    });            
            const color = peer?.Color || '#888';
            const lastMsg = chat.lastMessage || 'Нет сообщений';
            const lastMsgAt = chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString() : '';

            return `
                <div class="private-chat-item" data-user-id="${otherUserId}" data-chat-id="${chat.id}">
                    <div class="private-chat-avatar">${peerAvatar}</div>
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

    /* Удалено 5.4
    startSimulation() {
        setInterval(() => {
            const peers = Array.from(this.peers.values()).filter(p => p.Online);
            if (peers.length > 0) {
                const randomPeer = peers[Math.floor(Math.random() * peers.length)];
                this.setPeerTyping(randomPeer.Id, Math.random() > 0.7);
            }
        }, 5000);
    }
    */

    /**
     * Обработка нового сообщения
     * {Object} message - Новое сообщение
     */
    handleNewMessage(message) {
        // Пропускаем свои сообщения
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
        if (message.userId === this.localUser.Id) {
            return;
        }

        // Добавляем в историю, если ещё нет
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

    // ===== АВТОМАТИЧЕСКОЕ ПОДКЛЮЧЕНИЕ =====

    /**
     * Автоматическое подключение при загрузке страницы
     * {Promise<boolean>} Успех подключения
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