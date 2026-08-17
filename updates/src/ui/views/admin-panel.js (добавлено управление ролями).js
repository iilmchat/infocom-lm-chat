// src/ui/views/admin-panel.js (добавлено управление ролями)
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
        this.setupRoleManagement();
    }

    // ===== УПРАВЛЕНИЕ РОЛЯМИ =====

    /**
     * Настройка управления ролями
     */
    setupRoleManagement() {
        // Кнопка изменения роли по умолчанию
        document.getElementById('defaultRoleSaveBtn')?.addEventListener('click', () => {
            this.saveDefaultRole();
        });

        // Кнопка получения статистики ролей
        document.getElementById('roleStatsBtn')?.addEventListener('click', () => {
            this.loadRoleStats();
        });
    }

    /**
     * Загрузка статистики по ролям
     */
    async loadRoleStats() {
        try {
            const result = await this.app.multiUserManager.api.getRoleStats();
            if (result.success) {
                const stats = result.stats;
                this.renderRoleStats(stats);
            }
        } catch (error) {
            this.app.toast.error('Ошибка загрузки статистики ролей');
        }
    }

    /**
     * Отображение статистики ролей
     */
    renderRoleStats(stats) {
        const container = document.getElementById('roleStatsContainer');
        if (!container) return;

        const roles = ['Admin', 'Manager', 'User', 'Guest'];
        let html = '<div class="role-stats-grid">';
        
        roles.forEach(role => {
            const count = stats.roles?.[role] || 0;
            const icons = {
                'Admin': '🛡️',
                'Manager': '🔧',
                'User': '👤',
                'Guest': '👋'
            };
            html += `
                <div class="role-stat-card">
                    <div class="role-icon">${icons[role] || '👤'}</div>
                    <div class="role-name">${role}</div>
                    <div class="role-count">${count}</div>
                </div>
            `;
        });

        html += `
            <div class="role-stat-total">
                <div>Всего пользователей: <strong>${stats.totalUsers}</strong></div>
                <div>Онлайн: <strong>${stats.onlineUsers}</strong></div>
                <div>Забанено: <strong>${stats.bannedUsers}</strong></div>
            </div>
        </div>`;

        container.innerHTML = html;
    }

    /**
     * Сохранение роли по умолчанию
     */
    async saveDefaultRole() {
        const select = document.getElementById('defaultRoleSelect');
        const role = select?.value;

        if (!role) {
            this.app.toast.warning('Выберите роль');
            return;
        }

        try {
            const result = await this.app.multiUserManager.api.setDefaultRole({
                role: role
            });

            if (result.success) {
                this.app.toast.success(`Роль по умолчанию: ${role}`);
            } else {
                this.app.toast.error('Ошибка сохранения');
            }
        } catch (error) {
            this.app.toast.error('Ошибка сохранения роли');
        }
    }

    /**
     * Отображение пользователей с возможностью смены роли
     */
    renderUsers() {
        const container = document.getElementById('adminUserList');
        if (!container) return;

        const currentUser = this.app.multiUserManager.localUser;
        const isAdmin = this.app.multiUserManager.isAdminUser();

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
            u.userId?.toLowerCase().includes(searchQuery)
        );

        container.innerHTML = filteredUsers.map(user => {
            const isCurrentUser = user.userId === currentUser.id;
            const canManage = isAdmin && !isCurrentUser;

            return `
            <div class="admin-user-item">
                <div class="admin-user-info">
                    <span class="admin-user-avatar">${user.avatar || '👤'}</span>
                    <span class="admin-user-name">${sanitizeHTML(user.name || 'Unknown')}</span>
                    <span class="admin-user-role ${user.role?.toLowerCase()}">
                        ${this.getRoleIcon(user.role)} ${user.role || 'Guest'}
                    </span>
                    <span class="admin-user-status ${user.isOnline ? 'online' : 'offline'}">
                        ${user.isOnline ? '🟢 Онлайн' : '⚪ Офлайн'}
                    </span>
                    ${user.status === 'banned' ? '<span class="banned-badge">⛔ Забанен</span>' : ''}
                    ${isCurrentUser ? '<span class="self-badge">👤 Вы</span>' : ''}
                </div>
                <div class="admin-user-actions">
                    ${canManage ? `
                        <select class="role-select" data-user-id="${user.userId}" data-current-role="${user.role || 'Guest'}">
                            <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>🛡️ Админ</option>
                            <option value="Manager" ${user.role === 'Manager' ? 'selected' : ''}>🔧 Руководитель</option>
                            <option value="User" ${user.role === 'User' ? 'selected' : ''}>👤 Пользователь</option>
                            <option value="Guest" ${user.role === 'Guest' ? 'selected' : ''}>👋 Гость</option>
                        </select>
                        <button class="btn-role-save" data-user-id="${user.userId}" title="Сохранить роль">💾</button>
                    ` : ''}
                    ${!isCurrentUser ? `
                        <button onclick="window.adminPanel.muteUser('${user.userId}', 5)" title="Заглушить">🔇</button>
                        <button onclick="window.adminPanel.kickUser('${user.userId}')" title="Выгнать">🚪</button>
                        ${user.status === 'banned' 
                            ? `<button onclick="window.adminPanel.unbanUser('${user.userId}')" title="Разбанить">✅</button>`
                            : `<button onclick="window.adminPanel.banUser('${user.userId}')" title="Забанить">⛔</button>`
                        }
                    ` : ''}
                </div>
            </div>
        `}).join('');

        // Обработчики для изменения ролей
        container.querySelectorAll('.btn-role-save').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.dataset.userId;
                const select = container.querySelector(`.role-select[data-user-id="${userId}"]`);
                const role = select?.value;

                if (role) {
                    await this.changeUserRole(userId, role);
                }
            });
        });

        // Обработчик поиска
        const searchInput = document.getElementById('adminUserSearch');
        if (searchInput) {
            searchInput.oninput = () => this.renderUsers();
        }
    }

    /**
     * Получение иконки для роли
     */
    getRoleIcon(role) {
        const icons = {
            'Admin': '🛡️',
            'Manager': '🔧',
            'User': '👤',
            'Guest': '👋'
        };
        return icons[role] || '👤';
    }

    /**
     * Изменение роли пользователя
     */
    async changeUserRole(userId, newRole) {
        if (!confirm(`Изменить роль пользователя на ${newRole}?`)) return;

        try {
            const result = await this.app.multiUserManager.api.setUserRole({
                userId: userId,
                role: newRole,
                moderatorId: this.app.multiUserManager.localUser.id
            });

            if (result.success) {
                this.app.toast.success(`✅ Роль изменена на ${newRole}`);
                await this.loadData();
            } else {
                this.app.toast.error('❌ Ошибка изменения роли');
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка изменения роли');
        }
    }

    /**
     * Рендеринг вкладки настроек с управлением ролями
     */
    renderSettings() {
        const container = document.querySelector('.admin-settings-grid');
        if (!container) return;

        const settings = this.loadSettings();
        const defaultRole = settings.defaultRole || 'User';

        container.innerHTML = `
            <div class="setting-item" style="grid-column: 1 / -1;">
                <label>👤 Роль по умолчанию для новых пользователей</label>
                <select id="defaultRoleSelect" class="role-select">
                    <option value="Admin" ${defaultRole === 'Admin' ? 'selected' : ''}>🛡️ Администратор</option>
                    <option value="Manager" ${defaultRole === 'Manager' ? 'selected' : ''}>🔧 Руководитель</option>
                    <option value="User" ${defaultRole === 'User' ? 'selected' : ''}>👤 Пользователь</option>
                    <option value="Guest" ${defaultRole === 'Guest' ? 'selected' : ''}>👋 Гость</option>
                </select>
                <button id="defaultRoleSaveBtn" class="btn-primary" style="margin-top:8px;">💾 Сохранить роль по умолчанию</button>
            </div>

            <div class="setting-item" style="grid-column: 1 / -1;">
                <label>📊 Статистика ролей</label>
                <div id="roleStatsContainer" class="role-stats-container">
                    <button id="roleStatsBtn" class="btn-secondary">🔄 Загрузить статистику</button>
                </div>
            </div>

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
                defaultRole: document.getElementById('defaultRoleSelect')?.value || 'User'
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

    // ... остальные методы (renderRooms, renderStats, renderLogs и т.д.)
}