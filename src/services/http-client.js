// src/services/http-client.js
import { CONFIG } from '../config.js';

/**
 * HTTP клиент для работы с API
 * 
 * Этот класс предоставляет базовые функции для выполнения HTTP-запросов к API,
 * включая обработку ошибок, повторные попытки и таймауты.
 */
export class ChatApiClient {
    constructor() {
        // Устанавливаем базовый URL для всех запросов к API        
        this.baseUrl = this.getBaseUrl();
        // Таймаут по умолчанию для каждого запроса (30 секунд)        
        this.timeout = 30000;
        // Количество попыток повторного выполнения запроса при ошибке        
        this.retryAttempts = 3;
    }

    /**
     * Получает базовый URL из конфигурации приложения
     * {string} Базовый URL для API
     */    
    getBaseUrl() {
        // Извлекаем конфигурацию из глобального объекта или переменной CONFIG        
        const config = window.__CONFIG__ || CONFIG;
        // Формируем полный базовый URL с IP-адресом и портом сервера        
        return `http://${config.SERVER.DEFAULT_IP}:${config.SERVER.DEFAULT_PORT}/api`;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: this.timeout
        };

        const mergedOptions = { ...defaultOptions, ...options };
        
        if (mergedOptions.body && typeof mergedOptions.body === 'object') {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }

        let attempt = 0;
        while (attempt < this.retryAttempts) {
            try {
                const response = await this.fetchWithTimeout(url, mergedOptions);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                // Если все прошло успешно, парсим и возвращаем данные ответа                
                const data = await response.json();
                return data;
                
            } catch (error) {
                attempt++;

                // Если это была последняя попытка - выбрасываем ошибку                
                if (attempt === this.retryAttempts) {
                    throw error;
                }

                // Вычисляем задержку перед следующей попыткой с экспоненциальным backoff                
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Выполняет fetch запрос с таймаутом
     *  {string} url - URL для запроса
     *  {Object} options - Опции fetch запроса
     *  {Promise<Response>} Объект Response от fetch
     */    
    async fetchWithTimeout(url, options) {
        // Создаем контроллер прерывания для отмены запроса при таймауте
        const controller = new AbortController();
        
        // Устанавливаем таймер для автоматической отмены запроса
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);
        
        try {
            // Выполняем fetch с сигналом прерывания и остальными опциями
            const response = await fetch(url, {
                ...options,
                signal: controller.signal  // Подключаем сигнал для отмены
            });
            
            // Отменяем таймер, если запрос завершился успешно
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            // Отменяем таймер в случае ошибки
            clearTimeout(timeoutId);
            
            // Если это ошибка отмены из-за таймаута - выбрасываем специальное сообщение
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            // Для других ошибок пробрасываем их дальше
            throw error;
        }
    }

    // === Методы API ===

    /**
     * Отправка сообщения
     */
    async sendMessage(data) {
        return this.request('/chat/send', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Получение истории
     */
    async getHistory(roomId, limit = 100, offset = 0) {
        return this.request(`/chat/history/${roomId}?limit=${limit}&offset=${offset}`);
    }

    /**
     * Редактирование сообщения
     */
    async editMessage(data) {
        return this.request('/chat/edit', {
            //method: 'PUT',
            method: 'POST',            
            body: data
        });
    }

    /**
     * Удаление сообщения
     */
    /*
    async deleteMessage(roomId, messageId, userId) {
        return this.request(`/chat/delete/${roomId}/${messageId}/${userId}`, {
            method: 'DELETE'
        });
    }
    */
    async deleteMessage(roomId, messageId, userId) {
        return this.request(`/chat/delete/${roomId}/${messageId}/${userId}`, {
            method: 'POST',
            body: JSON.stringify({
                roomId,
                messageId,
                userId
            })
        });
    }
    /**
     * Создание комнаты
     */
    async createRoom(data) {
        return this.request('/room/create', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Long Polling
     */
    async poll(data) {
        return this.request('/sync/poll', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Получение статуса комнаты
     */
    async getRoomStatus(roomId) {
        return this.request(`/sync/status/${roomId}`);
    }
      
    /**
     * Установка статуса печатания
     */
    async setTypingStatus(data) {
        return this.request('/sync/typing', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Проверка доступности сервера (ping)
     */
    async ping() {
        return this.request('/sync/ping');
    }
        
    /**
     * Вход в комнату
     */
    async joinRoom(data) {
        return this.request('/room/join', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Выход из комнаты
     */
    async leaveRoom(data) {
        return this.request('/room/leave', {
            method: 'POST',
            body: data
        });
    }

    /**
     * Получение списка комнат
     */
    async getRooms() {
        return this.request('/room/list');
    }

    /**
     * Получение информации о комнате
     */
    async getRoomInfo(roomId) {
        return this.request(`/room/info/${roomId}`);
    }

    /**
     * Получение статуса комнаты (polling)
     */
    async getRoomStatus(roomId) {
        return this.request(`/room/status/${roomId}`);
    }
    
    // === Private Chat API ===

    async createPrivateChat(data) {
        return this.request('/private/chat/create', {
            method: 'POST',
            body: data
        });
    }

    async sendPrivateMessage(data) {
        return this.request('/private/message/send', {
            method: 'POST',
            body: data
        });
    }

    async getPrivateHistory(chatId, limit = 50, offset = 0) {
        return this.request(`/private/chat/${chatId}/history?limit=${limit}&offset=${offset}`);
    }

    async markPrivateRead(data) {
        return this.request('/private/chat/mark-read', {
            method: 'POST',
            body: data
        });
    }

    async getUnreadCount(userId) {
        return this.request(`/private/user/${userId}/unread`);
    }

    /*
    async deletePrivateMessage(messageId, userId) {
        return this.request(`/private/message/${messageId}?userId=${userId}`, {
            method: 'DELETE'
        });
    }
    */
    async deletePrivateMessage(messageId, userId) {
        return this.request(`/private/message/${messageId}`, {
            method: 'POST',
            body: JSON.stringify({ userId }) // Передаем userId в теле запроса
        });
    }   
    
    async editPrivateMessage(messageId, data) {
        return this.request(`/private/message/${messageId}`, {
            //method: 'PUT',
            method: 'POST',
            body: data
        });
    }

    async blockUser(data) {
        return this.request('/private/user/block', {
            method: 'POST',
            body: data
        });
    }

    async unblockUser(data) {
        return this.request('/private/user/unblock', {
            method: 'POST',
            body: data
        });
    }

    async getBlockedUsers(userId) {
        return this.request(`/private/user/${userId}/blocked`);
    }

    async heartbeat(data) {
        return this.request('/private/heartbeat', {
            method: 'POST',
            body: data
        });
    }

    async updateUserProfile(data) {
        return this.request('/private/user', {
            //method: 'PUT',
            method: 'POST',            
            body: data            
        });
    }

    async getUserChats(userId) {
        return this.request(`/private/user/${userId}/chats`);
    }    

    // === Admin API ===

    async getAllUsers() {
        return this.request('/admin/users');
    }

    async getOnlineUsers() {
        return this.request('/admin/users/online');
    }

    async getUserStats(userId) {
        return this.request(`/admin/user/${userId}/stats`);
    }

    //Получение информации о пользователе с сервера
    async getUser(userId) {
        return this.request(`/admin/user/${userId}`);
        //return this.request(`/admin/user/${userId}/stats`);
    }

    async setUserRole(userId, data) {
        return this.request(`/admin/user/${userId}/role`, {
            method: 'POST',
            body: data
        });
    }

    async muteUser(data) {
        return this.request(`/admin/user/${data.userId}/mute`, {
            method: 'POST',
            body: { 
                    minutes: data.minutes, 
                    moderatorId: data.moderatorId, 
                    reason: data.reason 
                }
        });
    }

    async kickUser(data) {
        return this.request(`/admin/user/${data.userId}/kick`, {
            method: 'POST',
            body: { 
                    roomId: data.roomId, 
                    moderatorId: data.moderatorId 
                }
        });
    }

    async banUser(data) {
        return this.request(`/admin/user/${data.userId}/ban`, {
            method: 'POST',
            body: { 
                    moderatorId: data.moderatorId, 
                    reason: data.reason 
                }
        });
    }

    async unbanUser(data) {
        return this.request(`/admin/user/${data.userId}/unban`, {
            method: 'POST',
            body: { 
                    moderatorId: data.moderatorId 
                }
        });
    }

    async clearRoomHistory(data) {
        return this.request(`/admin/room/${data.roomId}/history`, {
            method: 'DELETE'
        });
    }

    async deleteRoom(data) {
        return this.request(`/admin/room/${data.roomId}`, {
            method: 'DELETE'
        });
    }

    async closeRoom(data) {
        return this.request(`/admin/room/${data.roomId}/close`, {
            method: 'POST'
        });
    }

    async getAdminStats() {
        return this.request('/admin/stats');
    }

    async getModerationLog(userId = null) {
        const query = userId ? `?userId=${userId}` : '';
        return this.request(`/admin/logs${query}`);
    }

    async searchMessages(data) {
        return this.request('/admin/messages/search', {
            method: 'POST',
            body: data
        });
    }    

    async exportRoom(roomId, format = 'json') {
        return this.request(`/admin/room/${roomId}/export?format=${format}`);
    }

    async clearAllData() {
        return this.request('/admin/clear-all', {
            method: 'DELETE'
        });
    }

    async healthCheck() {
        return this.request('/admin/health');
    }    
}