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
            const [usersResult, roomsResult] = await Promise.all([
                this.app.multiUserManager.api.getAllUsers(),
                this.app.multiUserManager.api.getRooms()
            ]);

            if (usersResult.success) {
                this.users = usersResult.users || [];
                this.renderUsers();
            }

            if (roomsResult.success) {
                this.rooms = roomsResult.rooms || [];
                this.renderRooms();
            }
        } catch (error) {
            this.app.toast.error('Ошибка загрузки данных');
        }
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