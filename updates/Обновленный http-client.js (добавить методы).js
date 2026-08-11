// src/services/http-client.js
export class ChatApiClient {
    // ... существующие методы

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
}