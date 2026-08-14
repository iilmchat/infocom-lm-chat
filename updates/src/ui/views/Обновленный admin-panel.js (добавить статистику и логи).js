// src/ui/views/admin-panel.js

export class AdminPanel {
    // ... существующий код ...

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

    // ... остальной код ...
}