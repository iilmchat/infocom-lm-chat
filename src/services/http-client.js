// src/services/http-client.js
import { CONFIG } from '../config.js';

/**
 * HTTP клиент для работы с API
 */
export class ChatApiClient {
    constructor() {
        this.baseUrl = this.getBaseUrl();
        this.timeout = 30000;
        this.retryAttempts = 3;
    }

    getBaseUrl() {
        const config = window.__CONFIG__ || CONFIG;
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
                
                const data = await response.json();
                return data;
                
            } catch (error) {
                attempt++;
                if (attempt === this.retryAttempts) {
                    throw error;
                }
                
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
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
            method: 'PUT',
            body: data
        });
    }

    /**
     * Удаление сообщения
     */
    async deleteMessage(roomId, messageId, userId) {
        return this.request(`/chat/delete/${roomId}/${messageId}/${userId}`, {
            method: 'DELETE'
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
}