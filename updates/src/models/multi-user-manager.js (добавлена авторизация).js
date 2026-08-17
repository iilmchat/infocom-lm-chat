// src/models/multi-user-manager.js (добавлена авторизация)
import { CONFIG } from '../config.js';
import { ChatApiClient } from '../services/http-client.js';

export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = new ChatApiClient();
        this.localUser = this.loadUser();
        this.peers = new Map();
        this.roomId = null;
        this.roomName = null;
        this.isConnected = false;
        this.isPolling = false;
        this.messages = [];
        this.messageCount = 0;
        this.userRole = null; // Текущая роль пользователя
        this.isAdmin = false;
        this.isModerator = false;
        this.privateChats = [];
        this.unreadCount = 0;

        // Настройка обработчиков
        this.setupEventListeners();
        this.setupAuthEvents();
    }

    /**
     * Загрузка профиля пользователя
     */
    loadUser() {
        const stored = localStorage.getItem('user_profile');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                // Добавляем поля для авторизации
                user.token = user.token || null;
                user.role = user.role || 'Admin';
                return user;
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
            status: 'online',
            token: null,
            role: 'Admin'
        };
        this.saveUser(user);
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
    async updateProfile(name, avatar, color) {
        try {
            const result = await this.api.updateUserProfile({
                userId: this.localUser.id,
                name: name,
                avatar: avatar,
                color: color
            });

            if (result.success) {
                this.localUser.name = name;
                this.localUser.avatar = avatar;
                this.localUser.color = color;
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
     * Получение информации о пользователе с сервера
     */
    async fetchUserInfo() {
        try {
            const result = await this.api.getUser(this.localUser.id);
            if (result.success && result.user) {
                const userData = result.user;
                this.localUser.role = userData.role || 'Admin';
                this.localUser.status = userData.status || 'online';
                this.isAdmin = this.localUser.role === 'Admin';
                this.isModerator = this.isAdmin || this.localUser.role === 'Manager';
                this.saveUser(this.localUser);
                this.eventBus?.emit('user:info_updated', this.localUser);
                return userData;
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

        const userPriority = rolePriority[this.localUser.role] || 0;
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
            if (data.userId === this.localUser.id) {
                this.localUser.role = data.newRole;
                this.isAdmin = this.localUser.role === 'Admin';
                this.isModerator = this.isAdmin || this.localUser.role === 'Manager';
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
            userRoleDisplay.textContent = roleNames[this.localUser.role] || this.localUser.role;
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

    // ... остальные методы из предыдущей версии
}