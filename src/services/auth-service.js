// src/services/auth-service.js
import { ApiService } from './api-service.js';
import { ChatApiClient } from './http-client.js';

/**
 * Сервис аутентификации и управления сессиями
 */
export class AuthService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        //this.api = new ApiService(eventBus);
        this.api = new ChatApiClient(eventBus);
        this.currentUserId = null;
        this.token = null; // если используется токен
        this.isAuthenticated = false;
        this.localUser = null;
    }

    /**
     * Регистрация или обновление пользователя
     * {Object} userData - { userId, name, avatar, color }
     * {Promise<Object>} - данные пользователя
     */
    async registerUser(userData) {
        try {
            const result = await this.api.createUser(userData);
            if (result.success) {
                if(result.user.Id)
                {
                    this.currentUserId = result.user.Id;
                }
                else
                {
                    this.currentUserId = result.user.id;
                }
                this.isAuthenticated = true;
                // Сохраняем userId в localStorage для восстановления сессии
                localStorage.setItem('userId', this.currentUserId);
                // Если сервер возвращает токен, сохраняем его
                if (result.token) {
                    this.token = result.token;
                    localStorage.setItem('authToken', this.token);
                }
                this.eventBus?.emit('auth:login', result.user);
                return result.user;
            } else {
                throw new Error(result.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            throw error;
        }
    }

    /**
     * Получение данных пользователя по ID
     */
    async getUser(userId) {
        try {
            const result = await this.api.getUser(userId);
            if (result.success) {
                return result.user;
            }
            return null;
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            return null;
        }
    }

    /**
     * Восстановление сессии при загрузке страницы
     * @returns {Promise<Object|null>} - данные пользователя или null
     */
    async restoreSession() {
        let userId = localStorage.getItem('userId');
        const stored = localStorage.getItem('user_profile');
        if (stored) {
            this.localUser = JSON.parse(stored);
            userId = this.localUser.Id;
        }
        
        const token = localStorage.getItem('authToken');
        if (!userId) {
            return null;
        }
        // Проверяем существование пользователя на сервере
        const user = await this.getUser(userId);
        if (user) {
            this.currentUserId = userId;
            this.isAuthenticated = true;
            if (token) this.token = token;
            this.eventBus?.emit('auth:restored', user);
            return user;
        } else {
            // Пользователь не найден — очищаем localStorage
            localStorage.removeItem('userId');
            localStorage.removeItem('authToken');
            this.isAuthenticated = false;
            return null;
        }
    }

    /**
     * Выход из системы (завершение всех сессий)
     */
    async logout() {
        if (!this.currentUserId) return;
        try {
            await this.api.logoutAll({ userId: this.currentUserId });
            localStorage.removeItem('userId');
            localStorage.removeItem('authToken');
            this.currentUserId = null;
            this.isAuthenticated = false;
            this.eventBus?.emit('auth:logout');
        } catch (error) {
            console.error('Ошибка выхода:', error);
            // Даже при ошибке очищаем локальные данные
            localStorage.removeItem('userId');
            localStorage.removeItem('authToken');
            this.currentUserId = null;
            this.isAuthenticated = false;
        }
    }

    /**
     * Получение списка активных сессий пользователя
     */
    async getSessions(userId) {
        try {
            const result = await this.api.getSessions(userId);
            if (result.success) {
                return result.sessions;
            }
            return [];
        } catch (error) {
            console.error('Ошибка получения сессий:', error);
            return [];
        }
    }

    /**
     * Завершение конкретной сессии
     */
    async terminateSession(sessionId, userId) {
        try {
            const result = await this.api.deleteSession(sessionId, userId);
            return result.success;
        } catch (error) {
            console.error('Ошибка завершения сессии:', error);
            return false;
        }
    }
}