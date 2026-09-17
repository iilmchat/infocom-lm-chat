// src/models/notification-manager.js
/**
 * Управление уведомлениями пользователя.
 *
 * Изменено в 6.2:
 * - Добавлен метод addNotification() для создания локальных уведомлений (KI-004)
 * - fetchNotifications() сохраняет локальные уведомления при обновлении с сервера
 * - markRead() корректно обрабатывает локальные и серверные уведомления
 * - Добавлен метод clearLocal() для очистки локальных уведомлений
 */

/* Добавлено в 6.2: максимальный размер локального списка */
const MAX_LOCAL_NOTIFICATIONS = 100;

export class NotificationManager {
    constructor(app) {
        this.app = app;
        this.notifications = [];
        this.unreadCount = 0;
        this.pollInterval = null;
        this.startPolling();
    }

    /**
     * Загрузка уведомлений с сервера
     * @param {boolean} onlyUnread - Только непрочитанные
     */
    async fetchNotifications(onlyUnread = true) {
        try {
            const result = await this.app.apiService.getNotifications({
                userId: this.app.multiUserManager.localUser.Id,
                onlyUnread: onlyUnread,
                limit: 50
            });
            if (result.success) {
                /* Изменено в 6.2: сохраняем локальные уведомления при обновлении с сервера (KI-004) */
                const localNotifs = this.notifications.filter(n => n._local);
                this.notifications = [...localNotifs, ...(result.notifications || [])];
                this.unreadCount = this.notifications.filter(n => !n.isRead).length;
                this.app.eventBus.emit('notifications:updated', this.notifications);
                this.updateBadge();
            }
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
        }
    }

    /* Добавлено в 6.2: создание локального уведомления (KI-004)
       Используется для:
       - приватных сообщений в PrivateChatModule
       - упоминаний (@user) в приватных чатах
       - системных уведомлений клиента
       Не отправляется на сервер — живёт только в текущей сессии.

       @param {Object} payload
       @param {string} payload.type    - 'private_message' | 'mention' | 'system' | 'reaction' | 'message'
       @param {string} payload.title   - Заголовок (краткий)
       @param {string} [payload.body]  - Тело (сниппет, описание)
       @param {Object} [payload.data]  - Произвольные данные (chatId, userId, messageId)
       @param {boolean} [payload.silent] - Не показывать toast (по умолчанию false)
       @returns {Object|null} Созданное уведомление
    */
    addNotification({ type, title, body = '', data = {}, silent = false }) {
        if (!type || !title) {
            console.warn('⚠️ addNotification: пропущены обязательные поля (type, title)');
            return null;
        }

        const notif = {
            notificationId: 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
            type,
            title,
            body,
            data,
            isRead: false,
            createdAt: new Date().toISOString(),
            _local: true
        };

        this.notifications.unshift(notif);

        /* Ограничиваем размер, чтобы не рос бесконечно */
        if (this.notifications.length > MAX_LOCAL_NOTIFICATIONS) {
            this.notifications.length = MAX_LOCAL_NOTIFICATIONS;
        }

        this.unreadCount++;
        this.updateBadge();
        this.app.eventBus.emit('notifications:updated', this.notifications);

        if (!silent && this.app.toast) {
            const icon = this._getIconForType(type);
            this.app.toast.info(`${icon} ${title}`, 3000);
        }

        return notif;
    }

    /* Добавлено в 6.2: очистка всех локальных уведомлений (KI-004) */
    clearLocal() {
        this.notifications = this.notifications.filter(n => !n._local);
        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        this.updateBadge();
        this.app.eventBus.emit('notifications:updated', this.notifications);
    }

    /* Добавлено в 6.2: иконка по типу уведомления (KI-004) */
    _getIconForType(type) {
        const icons = {
            'private_message': '💬',
            'mention': '@',
            'reaction': '❤️',
            'system': 'ℹ️',
            'message': '💬'
        };
        return icons[type] || '🔔';
    }

    /**
     * Отметить уведомления прочитанными
     * @param {Array<string>} notificationIds - ID уведомлений (пусто = все)
     */
    async markRead(notificationIds = []) {
        /* Изменено в 6.2: помечаем локально перед отправкой на сервер (KI-004) */
        if (notificationIds.length === 0) {
            this.notifications.forEach(n => { n.isRead = true; });
        } else {
            for (const id of notificationIds) {
                const n = this.notifications.find(x => x.notificationId === id);
                if (n) n.isRead = true;
            }
        }
        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        this.updateBadge();

        /* На сервер отправляем только серверные ID (без 'local_') */
        const serverIds = notificationIds.filter(id => !id.startsWith('local_'));
        try {
            await this.app.apiService.markNotificationsRead({
                userId: this.app.multiUserManager.localUser.Id,
                notificationIds: serverIds
            });
            this.app.eventBus.emit('notifications:read', notificationIds);
        } catch (error) {
            console.error('Ошибка отметки прочитанных на сервере:', error);
        }
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    startPolling() {
        this.pollInterval = setInterval(() => {
            if (this.app.multiUserManager.isConnected) {
                this.fetchNotifications(true);
            }
        }, 30000); // каждые 30 секунд
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
}