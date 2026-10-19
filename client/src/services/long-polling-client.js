// src/services/long-polling-client.js
import { ChatApiClient } from './http-client.js';

/**
 * Long polling клиент для получения обновлений в реальном времени
 * Используется как fallback для SignalR
 */
export class LongPollingClient {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.api = new ChatApiClient();
        this.roomId = null;
        this.lastMessageId = null;
        this.pollingInterval = 3000;
        this.isPolling = false;
        this.stopRequested = false;
        this.pendingMessages = [];
        this.lastProcessedTimestamp = Date.now();
    }

    /**
     * Начать polling для комнаты
     */
    start(roomId, lastMessageId = null) {
        this.roomId = roomId;
        this.lastMessageId = lastMessageId;
        this.stopRequested = false;
        this.isPolling = true;
        this.poll();
    }

    /**
     * Остановить polling
     */
    stop() {
        this.stopRequested = true;
        this.isPolling = false;
        this.roomId = null;
    }

    /**
     * Основной цикл polling
     */
    async poll() {
        if (this.stopRequested || !this.roomId) return;

        try {
            // Получаем историю с момента последнего сообщения
            const result = await this.api.getHistory(this.roomId, 50);
            
            if (result.success && result.messages) {
                const newMessages = this.filterNewMessages(result.messages);
                
                if (newMessages.length > 0) {
                    // Обрабатываем новые сообщения
                    newMessages.forEach(message => {
                        this.eventBus?.emit('message:new', message);
                    });
                    
                    // Обновляем последний обработанный ID
                    this.lastMessageId = newMessages[newMessages.length - 1].Id;
                    this.lastProcessedTimestamp = Date.now();
                }
            }

            // Получаем статус пользователей
            const statusResult = await this.api.getRoomStatus(this.roomId);
            if (statusResult.success && statusResult.users) {
                this.eventBus?.emit('users:updated', statusResult.users);
            }

        } catch (error) {
            console.warn('Polling error:', error);
            // При ошибке делаем паузу перед повторной попыткой
            await this.delay(5000);
        }

        // Продолжаем polling
        if (!this.stopRequested) {
            setTimeout(() => this.poll(), this.pollingInterval);
        }
    }

    /**
     * Фильтрация новых сообщений
     */
    filterNewMessages(messages) {
        if (!this.lastMessageId) {
            return messages;
        }

        const lastIndex = messages.findIndex(m => m.Id === this.lastMessageId);
        if (lastIndex === -1) {
            // Если сообщение не найдено, возвращаем все
            return messages;
        }

        return messages.slice(lastIndex + 1);
    }

    /**
     * Задержка
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Отправка сообщения с подтверждением
     */
    async sendMessageWithConfirmation(data) {
        try {
            const result = await this.api.sendMessage(data);
            
            if (result.success) {
                // Ждем подтверждения от сервера
                const confirmed = await this.waitForMessageConfirmation(result.message.Id);
                return { success: true, message: result.message, confirmed };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Ожидание подтверждения сообщения
     */
    async waitForMessageConfirmation(messageId, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const result = await this.api.getHistory(this.roomId, 10);
            
            if (result.success) {
                const found = result.messages.some(m => m.Id === messageId);
                if (found) return true;
            }
            
            await this.delay(1000);
        }
        
        return false;
    }

    /**
     * Проверка статуса соединения
     */
    isActive() {
        return this.isPolling && !this.stopRequested;
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            isPolling: this.isPolling,
            roomId: this.roomId,
            lastMessageId: this.lastMessageId,
            pendingMessages: this.pendingMessages.length
        };
    }
}