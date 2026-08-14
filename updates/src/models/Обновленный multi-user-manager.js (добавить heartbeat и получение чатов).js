// src/models/multi-user-manager.js

export class MultiUserManager {
    // ... существующий код ...

    constructor(eventBus) {
        // ... существующая инициализация ...
        this.privateChats = [];
        this.heartbeatInterval = null;
        this.unreadCount = 0;
        this.setupHeartbeat();
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
                this.privateChats = result.chats || [];
                this.eventBus?.emit('private:chats_updated', this.privateChats);
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

    // ... остальной код ...
}