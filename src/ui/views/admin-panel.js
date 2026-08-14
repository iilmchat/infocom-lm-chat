// src/ui/views/admin-panel.js
import { Modal } from '../components/modal.js';

export class AdminPanel {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('adminModal'));
        this.users = [];
        this.rooms = [];
        this.setupEventListeners();
    }

    open() {
        this.loadData();
        this.modal.open();
    }

    close() {
        this.modal.close();
    }

    async loadData() {
        try {
            const [usersResult, roomsResult, statsResult, logsResult] = await Promise.all([
                this.app.multiUserManager.api.getAllUsers(),
                this.app.multiUserManager.api.getRooms(),
                this.app.multiUserManager.api.getAdminStats(),
                this.app.multiUserManager.api.getModerationLog()
            ]);

            if (usersResult.success) {
                this.users = usersResult.users || [];
                this.renderUsers();
            }

            if (roomsResult.success) {
                this.rooms = roomsResult.rooms || [];
                this.renderRooms();
            }

            if (statsResult.success) {
                this.renderStats(statsResult.stats);
            }

            if (logsResult.success) {
                this.renderLogs(logsResult.logs);
            }            
        } catch (error) {
            this.app.toast.error('Ошибка загрузки данных');
        }
    }

    renderStats(stats) {
        const container = document.getElementById('adminStats');
        if (!container) return;

        container.innerHTML = `
            <div class="admin-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalUsers || 0}</div>
                    <div class="stat-label">Всего пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.onlineUsers || 0}</div>
                    <div class="stat-label">Онлайн</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalRooms || 0}</div>
                    <div class="stat-label">Комнат</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalMessages || 0}</div>
                    <div class="stat-label">Сообщений</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.privateMessages || 0}</div>
                    <div class="stat-label">Приватных сообщений</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.bannedUsers || 0}</div>
                    <div class="stat-label">Забанено</div>
                </div>
            </div>
        `;
    }

    renderLogs(logs) {
        const container = document.getElementById('adminLogList');
        if (!container) return;

        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div style="padding:12px;color:var(--text-secondary);text-align:center;">
                    Нет записей в логе
                </div>
            `;
            return;
        }

        container.innerHTML = logs.slice(0, 50).map(log => `
            <div class="admin-log-entry">
                <span class="time">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="level-${log.action}">[${log.action.toUpperCase()}]</span>
                <span>${this.sanitizeHTML(log.moderatorName)} → ${this.sanitizeHTML(log.targetUserName)}</span>
                ${log.reason ? `<span style="color:var(--text-secondary);">: ${this.sanitizeHTML(log.reason)}</span>` : ''}
                ${log.durationMinutes > 0 ? `<span style="color:var(--text-secondary);">(${log.durationMinutes} мин)</span>` : ''}
            </div>
        `).join('');
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
        
    renderUsers() {
        const container = document.getElementById('adminUsersList');
        container.innerHTML = this.users.map(user => `
            <div class="admin-user-item">
                <div class="admin-user-info">
                    <span class="admin-user-avatar">${user.avatar || '👤'}</span>
                    <span class="admin-user-name">${user.name}</span>
                    <span class="admin-user-status ${user.isOnline ? 'online' : 'offline'}">
                        ${user.isOnline ? '🟢 Онлайн' : '⚪ Офлайн'}
                    </span>
                </div>
                <div class="admin-user-actions">
                    <button onclick="window.adminPanel.muteUser('${user.id}', 5)" title="Заглушить на 5 минут">🔇</button>
                    <button onclick="window.adminPanel.kickUser('${user.id}')" title="Выгнать">🚪</button>
                    <button onclick="window.adminPanel.banUser('${user.id}')" title="Забанить">⛔</button>
                    ${user.isAdmin ? '<span class="admin-badge">Админ</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    renderRooms() {
        const container = document.getElementById('adminRoomsList');
        container.innerHTML = this.rooms.map(room => `
            <div class="admin-room-item">
                <div class="admin-room-info">
                    <span class="admin-room-name">💬 ${room.name}</span>
                    <span class="admin-room-users">👥 ${room.userCount || 0}</span>
                    <span class="admin-room-messages">💬 ${room.messageCount || 0}</span>
                </div>
                <div class="admin-room-actions">
                    <button onclick="window.adminPanel.clearRoom('${room.id}')" title="Очистить историю">🗑️</button>
                    <button onclick="window.adminPanel.deleteRoom('${room.id}')" title="Удалить комнату">❌</button>
                </div>
            </div>
        `).join('');
    }

    async muteUser(userId, minutes) {
        if (!confirm(`Заглушить пользователя на ${minutes} минут?`)) return;
        
        try {
            await this.app.multiUserManager.api.muteUser({
                userId: userId,
                minutes: minutes
            });
            this.app.toast.success(`🔇 Пользователь заглушен на ${minutes} минут`);
            this.loadData();
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async kickUser(userId) {
        if (!confirm('Выгнать пользователя?')) return;
        
        try {
            await this.app.multiUserManager.api.kickUser({ userId });
            this.app.toast.success('🚪 Пользователь выгнан');
            this.loadData();
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async banUser(userId) {
        if (!confirm('Забанить пользователя?')) return;
        
        try {
            await this.app.multiUserManager.api.banUser({ userId });
            this.app.toast.success('⛔ Пользователь забанен');
            this.loadData();
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async clearRoom(roomId) {
        if (!confirm('Очистить историю комнаты?')) return;
        
        try {
            await this.app.multiUserManager.api.clearRoomHistory({ roomId });
            this.app.toast.success('🗑️ История очищена');
            this.loadData();
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async deleteRoom(roomId) {
        if (!confirm('Удалить комнату?')) return;
        
        try {
            await this.app.multiUserManager.api.deleteRoom({ roomId });
            this.app.toast.success('❌ Комната удалена');
            this.loadData();
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    setupEventListeners() {
        document.getElementById('adminBtn')?.addEventListener('click', () => this.open());
        document.getElementById('adminModalClose')?.addEventListener('click', () => this.close());
        document.getElementById('adminRefreshBtn')?.addEventListener('click', () => this.loadData());
    }
}

// Для доступа из HTML
window.adminPanel = null;