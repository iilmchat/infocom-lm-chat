// src/ui/views/admin-panel.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

export class AdminPanel {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('adminModal'));
        this.users = [];
        this.rooms = [];
        this.messages = [];
        this.logs = [];
        this.stats = null;
        this.currentTab = 'users';
        this.setupEventListeners();
        this.setupTabSwitching();
    }

    open() {
        this.loadData();
        this.modal.open();
        // По умолчанию показываем вкладку пользователей
        this.switchTab('users');
    }

    close() {
        this.modal.close();
    }

    /**
     * Настройка переключения вкладок
     */
    setupTabSwitching() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    }

    /**
     * Переключение вкладки
     */
    switchTab(tabName) {
        // Обновляем активную вкладку
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Скрываем все содержимое вкладок
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        // Показываем выбранную вкладку
        const targetContent = document.getElementById(`tab-${tabName}`);
        if (targetContent) {
            targetContent.style.display = 'block';
        }

        this.currentTab = tabName;

        // Загружаем данные для вкладки
        switch (tabName) {
            case 'users':
                this.renderUsers();
                break;
            case 'rooms':
                this.renderRooms();
                break;
            case 'messages':
                this.loadMessages();
                break;
            case 'stats':
                this.renderStats();
                break;
            case 'logs':
                this.loadLogs();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    /**
     * Загрузка всех данных
     */
    async loadData() {
        try {
            // Показываем индикатор загрузки
            this.showLoading();

            const [usersResult, roomsResult, statsResult, logsResult] = await Promise.all([
                this.app.multiUserManager.api.getAllUsers().catch(() => ({ success: false })),
                this.app.multiUserManager.api.getRooms().catch(() => ({ success: false })),
                this.app.multiUserManager.api.getAdminStats().catch(() => ({ success: false })),
                this.app.multiUserManager.api.getModerationLog().catch(() => ({ success: false }))
            ]);

            if (usersResult.success) {
                this.users = usersResult.users || [];
            }

            if (roomsResult.success) {
                this.rooms = roomsResult.rooms || [];
            }

            if (statsResult.success) {
                this.stats = statsResult.stats;
            }

            if (logsResult.success) {
                this.logs = logsResult.logs || [];
            }

            // Рендерим текущую вкладку
            this.renderCurrentTab();

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.app.toast.error('❌ Ошибка загрузки данных');
        } finally {
            this.hideLoading();
        }
    }

    renderCurrentTab() {
        switch (this.currentTab) {
            case 'users':
                this.renderUsers();
                break;
            case 'rooms':
                this.renderRooms();
                break;
            case 'messages':
                this.renderMessages();
                break;
            case 'stats':
                this.renderStats();
                break;
            case 'logs':
                this.renderLogs();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    showLoading() {
        // Можно добавить индикатор загрузки
    }

    hideLoading() {
        // Скрыть индикатор загрузки
    }

    // ===== ВКЛАДКА: ПОЛЬЗОВАТЕЛИ =====

    renderUsers() {
        const container = document.getElementById('adminUserList');
        if (!container) return;

        if (!this.users || this.users.length === 0) {
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    👥 Пользователей нет
                </div>
            `;
            return;
        }

        const searchQuery = document.getElementById('adminUserSearch')?.value?.toLowerCase() || '';
        const filteredUsers = this.users.filter(u => 
            u.name?.toLowerCase().includes(searchQuery) ||
            u.id?.toLowerCase().includes(searchQuery)
        );

        container.innerHTML = filteredUsers.map(user => `
            <div class="admin-user-item">
                <div class="admin-user-info">
                    <span class="admin-user-avatar">${user.avatar || '👤'}</span>
                    <span class="admin-user-name">${sanitizeHTML(user.name || 'Unknown')}</span>
                    <span class="admin-user-status ${user.isOnline ? 'online' : 'offline'}">
                        ${user.isOnline ? '🟢 Онлайн' : '⚪ Офлайн'}
                    </span>
                    ${user.isAdmin ? '<span class="admin-badge">🛡️ Админ</span>' : ''}
                    ${user.isModerator ? '<span class="moderator-badge">🔧 Модератор</span>' : ''}
                    ${user.isBanned ? '<span class="banned-badge">⛔ Забанен</span>' : ''}
                </div>
                <div class="admin-user-actions">
                    <button onclick="window.adminPanel.muteUser('${user.id}', 5)" title="Заглушить на 5 минут">🔇</button>
                    <button onclick="window.adminPanel.kickUser('${user.id}')" title="Выгнать">🚪</button>
                    <button onclick="window.adminPanel.banUser('${user.id}')" title="Забанить">⛔</button>
                    ${user.isBanned ? `<button onclick="window.adminPanel.unbanUser('${user.id}')" title="Разбанить">✅</button>` : ''}
                    <button onclick="window.adminPanel.setAdmin('${user.id}', ${!user.isAdmin})" title="Админ">🛡️</button>
                    <button onclick="window.adminPanel.setModerator('${user.id}', ${!user.isModerator})" title="Модератор">🔧</button>
                </div>
                <div class="admin-user-detail" style="font-size:11px;color:var(--text-secondary);padding:4px 8px;">
                    Сообщений: ${user.messageCount || 0} | Комнат: ${user.roomCount || 0}
                    ${user.mutedUntil ? `| Заглушен до: ${new Date(user.mutedUntil).toLocaleString()}` : ''}
                    ${user.banReason ? `| Причина: ${sanitizeHTML(user.banReason)}` : ''}
                </div>
            </div>
        `).join('');

        // Обработчик поиска
        const searchInput = document.getElementById('adminUserSearch');
        if (searchInput) {
            searchInput.oninput = () => this.renderUsers();
        }
    }

    // ===== ВКЛАДКА: КОМНАТЫ =====

    renderRooms() {
        const container = document.getElementById('adminRoomList');
        if (!container) return;

        if (!this.rooms || this.rooms.length === 0) {
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    💬 Комнат нет
                </div>
            `;
            return;
        }

        container.innerHTML = this.rooms.map(room => `
            <div class="admin-room-item">
                <div class="admin-room-info">
                    <span class="admin-room-name">💬 ${sanitizeHTML(room.name || room.roomId)}</span>
                    <span class="admin-room-users">👥 ${room.userCount || 0}</span>
                    <span class="admin-room-messages">💬 ${room.messageCount || 0}</span>
                    <span class="admin-room-status ${room.isActive ? 'active' : 'inactive'}">
                        ${room.isActive ? '🟢 Активна' : '⚪ Неактивна'}
                    </span>
                </div>
                <div class="admin-room-actions">
                    <button onclick="window.adminPanel.clearRoom('${room.roomId || room.id}')" title="Очистить историю">🗑️</button>
                    <button onclick="window.adminPanel.deleteRoom('${room.roomId || room.id}')" title="Удалить комнату">❌</button>
                    <button onclick="window.adminPanel.closeRoom('${room.roomId || room.id}')" title="Закрыть комнату">🔒</button>
                    <button onclick="window.adminPanel.exportRoom('${room.roomId || room.id}')" title="Экспортировать">💾</button>
                </div>
            </div>
        `).join('');
    }

    // ===== ВКЛАДКА: СООБЩЕНИЯ =====

    async loadMessages() {
        const searchInput = document.getElementById('adminMsgSearch');
        const query = searchInput?.value || '';

        try {
            if (query.length < 2) {
                this.renderMessages([]);
                return;
            }

            const result = await this.app.multiUserManager.api.searchMessages({
                query: query,
                limit: 100
            });

            if (result.success) {
                this.messages = result.results || [];
                this.renderMessages();
            } else {
                this.messages = [];
                this.renderMessages();
                this.app.toast.warning('Не удалось найти сообщения');
            }
        } catch (error) {
            console.error('Ошибка поиска сообщений:', error);
            this.messages = [];
            this.renderMessages();
            this.app.toast.error('❌ Ошибка поиска');
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('adminMessageList');
        if (!container) return;

        const msgList = messages || this.messages || [];

        if (msgList.length === 0) {
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    📝 Введите запрос для поиска сообщений
                </div>
            `;
            return;
        }

        container.innerHTML = msgList.map(msg => `
            <div class="admin-message-item">
                <div class="admin-message-header">
                    <span class="admin-message-user">${sanitizeHTML(msg.userName || 'Unknown')}</span>
                    <span class="admin-message-room">${sanitizeHTML(msg.roomName || msg.roomId || '')}</span>
                    <span class="admin-message-time">${new Date(msg.timestamp).toLocaleString()}</span>
                    <button class="admin-message-delete" onclick="window.adminPanel.deleteMessage('${msg.id}')" title="Удалить">🗑️</button>
                </div>
                <div class="admin-message-content">${sanitizeHTML(msg.content)}</div>
            </div>
        `).join('');
    }

    // ===== ВКЛАДКА: СТАТИСТИКА =====

    renderStats() {
        const container = document.getElementById('adminStats');
        if (!container) return;

        const stats = this.stats || {};

        container.innerHTML = `
            <div class="admin-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalUsers || 0}</div>
                    <div class="stat-label">👥 Всего пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.onlineUsers || 0}</div>
                    <div class="stat-label">🟢 Онлайн</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalRooms || 0}</div>
                    <div class="stat-label">💬 Комнат</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.totalMessages || 0}</div>
                    <div class="stat-label">📝 Сообщений</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.privateMessages || 0}</div>
                    <div class="stat-label">🔒 Приватных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.bannedUsers || 0}</div>
                    <div class="stat-label">⛔ Забанено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.mutedUsers || 0}</div>
                    <div class="stat-label">🔇 Заглушено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.uptime ? new Date(stats.uptime).toLocaleString() : '—'}</div>
                    <div class="stat-label">⏱️ Время работы</div>
                </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
                <button onclick="window.adminPanel.loadData()" class="btn-secondary">🔄 Обновить</button>
                <button onclick="window.adminPanel.clearAll()" class="btn-secondary" style="color:var(--error-color);">🗑️ Очистить всё</button>
            </div>
        `;
    }

    // ===== ВКЛАДКА: ЛОГИ =====

    async loadLogs() {
        try {
            const result = await this.app.multiUserManager.api.getModerationLog();
            if (result.success) {
                this.logs = result.logs || [];
                this.renderLogs();
            }
        } catch (error) {
            console.error('Ошибка загрузки логов:', error);
            this.app.toast.error('❌ Ошибка загрузки логов');
        }
    }

    renderLogs() {
        const container = document.getElementById('adminLogList');
        if (!container) return;

        const logs = this.logs || [];

        if (logs.length === 0) {
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    📋 Нет записей в логе
                </div>
            `;
            return;
        }

        container.innerHTML = logs.slice(0, 100).map(log => `
            <div class="admin-log-entry">
                <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                <span class="log-action log-${log.action}">[${log.action.toUpperCase()}]</span>
                <span class="log-moderator">${sanitizeHTML(log.moderatorName || 'System')}</span>
                <span class="log-arrow">→</span>
                <span class="log-target">${sanitizeHTML(log.targetUserName || log.targetUserId)}</span>
                ${log.reason ? `<span class="log-reason">: ${sanitizeHTML(log.reason)}</span>` : ''}
                ${log.durationMinutes > 0 ? `<span class="log-duration">(${log.durationMinutes} мин)</span>` : ''}
            </div>
        `).join('');
    }

    // ===== ВКЛАДКА: НАСТРОЙКИ =====

    renderSettings() {
        const container = document.querySelector('.admin-settings-grid');
        if (!container) return;

        // Загружаем текущие настройки из localStorage
        const settings = this.loadSettings();

        container.innerHTML = `
            <div class="setting-item">
                <label>Макс. длина сообщения</label>
                <input type="number" id="settingMaxLength" value="${settings.maxLength || 10000}" min="100" max="100000">
            </div>
            <div class="setting-item">
                <label>Макс. пользователей в комнате</label>
                <input type="number" id="settingMaxUsers" value="${settings.maxUsers || 50}" min="1" max="500">
            </div>
            <div class="setting-item">
                <label>Таймаут неактивности (мин)</label>
                <input type="number" id="settingInactiveTimeout" value="${settings.inactiveTimeout || 5}" min="1" max="60">
            </div>
            <div class="setting-item">
                <label>Макс. сообщений в истории</label>
                <input type="number" id="settingMaxHistory" value="${settings.maxHistory || 1000}" min="50" max="10000">
            </div>
            <div class="setting-item">
                <label>Автоочистка RAG</label>
                <select id="settingAutoClearRag">
                    <option value="true" ${settings.autoClearRag !== false ? 'selected' : ''}>Включена</option>
                    <option value="false" ${settings.autoClearRag === false ? 'selected' : ''}>Отключена</option>
                </select>
            </div>
            <div class="setting-item" style="grid-column: 1 / -1;">
                <button id="settingSaveBtn" class="btn-primary">💾 Сохранить настройки</button>
                <button id="settingResetBtn" class="btn-secondary" style="margin-left:8px;">↺ Сбросить</button>
            </div>
        `;

        // Обработчики
        document.getElementById('settingSaveBtn')?.addEventListener('click', () => {
            this.saveSettings({
                maxLength: parseInt(document.getElementById('settingMaxLength').value) || 10000,
                maxUsers: parseInt(document.getElementById('settingMaxUsers').value) || 50,
                inactiveTimeout: parseInt(document.getElementById('settingInactiveTimeout').value) || 5,
                maxHistory: parseInt(document.getElementById('settingMaxHistory').value) || 1000,
                autoClearRag: document.getElementById('settingAutoClearRag').value === 'true'
            });
            this.app.toast.success('✅ Настройки сохранены');
        });

        document.getElementById('settingResetBtn')?.addEventListener('click', () => {
            if (confirm('Сбросить настройки к значениям по умолчанию?')) {
                this.resetSettings();
                this.renderSettings();
                this.app.toast.info('Настройки сброшены');
            }
        });
    }

    loadSettings() {
        try {
            const data = localStorage.getItem('admin_settings');
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    saveSettings(settings) {
        try {
            const current = this.loadSettings();
            const updated = { ...current, ...settings };
            localStorage.setItem('admin_settings', JSON.stringify(updated));
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
            this.app.toast.error('❌ Ошибка сохранения настроек');
        }
    }

    resetSettings() {
        try {
            localStorage.removeItem('admin_settings');
        } catch (error) {
            console.error('Ошибка сброса настроек:', error);
        }
    }

    // ===== ДЕЙСТВИЯ МОДЕРАТОРА =====

    async muteUser(userId, minutes) {
        if (!confirm(`Заглушить пользователя на ${minutes} минут?`)) return;

        try {
            const result = await this.app.multiUserManager.api.muteUser({
                userId: userId,
                minutes: minutes,
                moderatorId: this.app.multiUserManager.localUser.id,
                reason: prompt('Причина (опционально):') || undefined
            });
            if (result.success) {
                this.app.toast.success(`🔇 Пользователь заглушен на ${minutes} минут`);
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async kickUser(userId) {
        if (!confirm('Выгнать пользователя?')) return;

        try {
            const result = await this.app.multiUserManager.api.kickUser({
                userId: userId,
                roomId: this.app.multiUserManager.roomId,
                moderatorId: this.app.multiUserManager.localUser.id
            });
            if (result.success) {
                this.app.toast.success('🚪 Пользователь выгнан');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async banUser(userId) {
        if (!confirm('Забанить пользователя?')) return;

        try {
            const result = await this.app.multiUserManager.api.banUser({
                userId: userId,
                moderatorId: this.app.multiUserManager.localUser.id,
                reason: prompt('Причина бана:') || 'Нарушение правил'
            });
            if (result.success) {
                this.app.toast.success('⛔ Пользователь забанен');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async unbanUser(userId) {
        if (!confirm('Разбанить пользователя?')) return;

        try {
            const result = await this.app.multiUserManager.api.unbanUser({
                userId: userId,
                moderatorId: this.app.multiUserManager.localUser.id
            });
            if (result.success) {
                this.app.toast.success('✅ Пользователь разбанен');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async setAdmin(userId, set) {
        try {
            const result = await this.app.multiUserManager.api.setUserRole(userId, {
                role: 'admin',
                set: set
            });
            if (result.success) {
                this.app.toast.success(`🛡️ Админ ${set ? 'назначен' : 'снят'}`);
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async setModerator(userId, set) {
        try {
            const result = await this.app.multiUserManager.api.setUserRole(userId, {
                role: 'moderator',
                set: set
            });
            if (result.success) {
                this.app.toast.success(`🔧 Модератор ${set ? 'назначен' : 'снят'}`);
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async clearRoom(roomId) {
        if (!confirm('Очистить историю комнаты?')) return;

        try {
            const result = await this.app.multiUserManager.api.clearRoomHistory({
                roomId: roomId
            });
            if (result.success) {
                this.app.toast.success('🗑️ История очищена');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async deleteRoom(roomId) {
        if (!confirm('Удалить комнату?')) return;

        try {
            const result = await this.app.multiUserManager.api.deleteRoom({
                roomId: roomId
            });
            if (result.success) {
                this.app.toast.success('❌ Комната удалена');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async closeRoom(roomId) {
        if (!confirm('Закрыть комнату?')) return;

        try {
            const result = await this.app.multiUserManager.api.closeRoom({
                roomId: roomId
            });
            if (result.success) {
                this.app.toast.success('🔒 Комната закрыта');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async deleteMessage(messageId) {
        if (!confirm('Удалить сообщение?')) return;

        try {
            const result = await this.app.multiUserManager.api.deleteMessage(
                null, // roomId не нужен для админского удаления
                messageId,
                this.app.multiUserManager.localUser.id
            );
            if (result.success) {
                this.app.toast.success('🗑️ Сообщение удалено');
                // Обновляем список сообщений
                this.messages = this.messages.filter(m => m.id !== messageId);
                this.renderMessages();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    async exportRoom(roomId) {
        try {
            const result = await this.app.multiUserManager.api.exportRoom(roomId, 'json');
            if (result.success) {
                // Создаем файл для скачивания
                const data = result.data || result.data1;
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `room_${roomId}_export.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.app.toast.success('💾 Экспорт выполнен');
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка экспорта');
        }
    }

    async clearAll() {
        if (!confirm('⚠️ Очистить все данные? Это действие необратимо!')) return;
        if (!confirm('Вы уверены?')) return;

        try {
            const result = await this.app.multiUserManager.api.clearAllData();
            if (result.success) {
                this.app.toast.success('🗑️ Все данные очищены');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ =====

    setupEventListeners() {
        // Открытие
        document.getElementById('adminBtn')?.addEventListener('click', () => this.open());

        // Закрытие
        document.getElementById('adminModalClose')?.addEventListener('click', () => this.close());

        // Обновление
        document.getElementById('adminRefreshBtn')?.addEventListener('click', () => this.loadData());

        // Поиск сообщений
        document.getElementById('adminMsgSearchBtn')?.addEventListener('click', () => {
            this.loadMessages();
        });

        document.getElementById('adminMsgSearch')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.loadMessages();
            }
        });

        // Очистка логов
        document.getElementById('adminLogClear')?.addEventListener('click', async () => {
            if (confirm('Очистить логи?')) {
                // В реальном проекте здесь должен быть API для очистки логов
                this.app.toast.info('Функция очистки логов в разработке');
            }
        });

        // Закрытие по клику на overlay
        document.getElementById('adminModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('adminModal')) {
                this.close();
            }
        });
    }
}

// Для доступа из HTML
window.adminPanel = null;