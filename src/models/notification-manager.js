// src/models/notification-manager.js
export class NotificationManager {
    constructor(app) {
        this.app = app;
        this.notifications = [];
        this.unreadCount = 0;
        this.pollInterval = null;
        this.startPolling();
    }

    async fetchNotifications(onlyUnread = true) {
        try {
            const result = await this.app.apiService.getNotifications({
                userId: this.app.multiUserManager.localUser.id,
                onlyUnread: onlyUnread,
                limit: 50
            });
            if (result.success) {
                this.notifications = result.notifications || [];
                this.unreadCount = result.unreadCount || 0;
                this.app.eventBus.emit('notifications:updated', this.notifications);
                this.updateBadge();
            }
        } catch (error) {
            console.error('Ошибка загрузки уведомлений:', error);
        }
    }

    async markRead(notificationIds = []) {
        try {
            const result = await this.app.apiService.markNotificationsRead({
                userId: this.app.multiUserManager.localUser.id,
                notificationIds: notificationIds
            });
            if (result.success) {
                this.unreadCount = result.unreadCount || 0;
                this.updateBadge();
                this.app.eventBus.emit('notifications:read', notificationIds);
            }
        } catch (error) {
            console.error('Ошибка отметки прочитанных:', error);
        }
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
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