// src/ui/views/admin-panel.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Панель администратора/модератора
 * Изменено в 5.1: добавлены все действия (бан, мут, кик, управление комнатами)
  * Изменено в 5.2: добавлены:
 * - Отображение списка пользователей в комнате (по клику на количество)
 * - Расширенный поиск по сообщениям с фильтрами (дата, автор, комната)
 */
/* Изменено в 5.3 — пагинация пользователей, URL-фильтры, экспорт */

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

        // Для комнат: кэш пользователей и состояние раскрытия
        this.roomUsersCache = new Map(); // roomId -> users[]
        this.expandedRooms = new Set();   // roomId

        // Для поиска сообщений: пагинация
        this.searchOffset = 0;
        this.searchLimit = 20;
        this.searchTotal = 0;
        this.searchResults = [];

        //пагинация пользователей
        this.userPage = 1;                 /* Добавлено в 5.3 */
        this.userPageSize = 20;            /* Добавлено в 5.3 */
        this.userTotal = 0;                /* Добавлено в 5.3 */
        this.userSearch = '';              /* Добавлено в 5.3 */

        this.setupEventListeners();
        this.setupTabSwitching();
        this.setupRoleManagement();  

        // Привязка методов
        this.toggleRoomUsers = this.toggleRoomUsers.bind(this);
        this.loadRoomUsers = this.loadRoomUsers.bind(this);
        this.renderRoomUsersHTML = this.renderRoomUsersHTML.bind(this);
        this.loadMessagesWithFilters = this.loadMessagesWithFilters.bind(this);
        this.renderSearchUI = this.renderSearchUI.bind(this);
        this.populateRoomSelect = this.populateRoomSelect.bind(this);
        this.populateUserSelect = this.populateUserSelect.bind(this);
        this.renderPagination = this.renderPagination.bind(this);
        this.handleRoomAction = this.handleRoomAction.bind(this);              
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

    // ===== ОТКРЫТИЕ / ЗАКРЫТИЕ =====

    /**
     * Открыть панель администрирования
     */
    open() {
        this.loadData();
        this.modal.open();
        // По умолчанию показываем вкладку пользователей
        this.switchTab('users');
    }

    /**
     * Закрыть панель администрирования
     */
    close() {
        this.modal.close();
    }

    // ===== ВКЛАДКИ =====    

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

        // Добавляем вызов renderSearchUI() при переходе на вкладку messages
        /*
        if (tabName === 'messages') {
            this.renderSearchUI();
        }
        */

        // Загружаем данные для вкладки
        switch (tabName) {
            case 'users':
                this.renderUsers();
                break;
            case 'rooms':
                this.renderRooms();
                break;
            case 'messages':
                //this.loadMessages();
                this.renderSearchUI();
                break;
            case 'stats':
                this.renderStats();
                break;
            case 'logs':
                //this.loadLogs();
                this.renderLogs();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }
    }

    // ===== ЗАГРУЗКА ДАННЫХ =====

    /**
     * Загрузка всех данных
     */
    async loadData() {
        // Показываем индикатор загрузки
        this.showLoading();        
        try {
            // Загружаем всё параллельно
            const [users, rooms, stats, logs] = await Promise.all([
                this.app.apiService.getAllUsers().catch(() => ({ success: false })),
                this.app.apiService.getAdminRooms().catch(() => ({ success: false })),
                this.app.apiService.getAdminStats().catch(() => ({ success: false })),
                this.app.apiService.getModerationLogs().catch(() => ({ success: false }))
            ]);
            if (users.success) this.users = users.users || [];
            if (rooms.success) this.rooms = rooms.rooms || [];
            if (stats.success) this.stats = stats.stats || {};
            if (logs.success) this.logs = logs.logs || [];

            // Сброс кэша комнат при обновлении
            this.roomUsersCache.clear();
            this.expandedRooms.clear();       

            // Рендерим текущую вкладку
            this.renderCurrentTab();

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);            
            this.app.toast.error('❌ Ошибка загрузки данных админки');
        } finally {
            this.hideLoading();
        }
    }
  
    /**
     * Отображение пользователей с возможностью управления
     * Изменено в 5.1: добавлены кнопки бан, мут, кик, смена роли
     */
    // ===== ВКЛАДКА: ПОЛЬЗОВАТЕЛИ (без изменений) =====    
    renderUsers() {
        const container = document.getElementById('adminUserList');
        if (!container) return;
        // ... рендеринг списка, используя this.users
        // добавляем кнопки пагинации
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
            //u.name?.toLowerCase().includes(searchQuery) ||
            //u.userId?.toLowerCase().includes(searchQuery)
        {
            // Если searchQuery пустой, возвращаем true (показываем все)
            return !searchQuery || searchQuery.trim() === '' || 
                u.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.UserId?.toLowerCase().includes(searchQuery.toLowerCase());
        });
                
        container.innerHTML = filteredUsers.map(user => {
            if(!(user.UserId) || user.UserId == undefined)
            {
                user.UserId = user.Id;
            }
            const isCurrentUser = user.UserId === currentUser.Id;
            const canManage = isAdmin && !isCurrentUser;
            const userName = user.Name && user.Name.trim() ? user.Name : 'Unknown';
            return `
            <div class="admin-user-item">
                <div class="admin-user-info">
                    <span class="admin-user-avatar">${user.Avatar || '👤'}</span>
                    <span class="admin-user-name">${sanitizeHTML(userName)}</span>
                    <span class="admin-user-role ${user.Role?.toLowerCase()}">
                        ${this.getRoleIcon(user.Role)} ${user.Role || 'Admin'}
                    </span>
                    <span class="admin-user-status ${user.IsOnline ? 'online' : 'offline'}">
                        ${user.IsOnline ? '🟢 Онлайн' : '⚪ Офлайн'}
                    </span>
                    ${user.Status === 'banned' ? '<span class="banned-badge">⛔ Забанен</span>' : ''}
                    ${isCurrentUser ? '<span class="self-badge">👤 Вы</span>' : ''}
                </div>
                <div class="admin-user-actions">
                    ${canManage ? `
                        <select class="role-select" data-user-id="${user.UserId}" data-current-role="${user.Role || 'Admin'}">
                            <option value="Admin" ${user.Role === 'Admin' ? 'selected' : ''}>🛡️ Админ</option>
                            <option value="Manager" ${user.Role === 'Manager' ? 'selected' : ''}>🔧 Руководитель</option>
                            <option value="User" ${user.Role === 'User' ? 'selected' : ''}>👤 Пользователь</option>
                            <option value="Guest" ${user.Role === 'Guest' ? 'selected' : ''}>👋 Гость</option>
                        </select>
                        <button class="btn-role-save" data-user-id="${user.UserId}" title="Сохранить роль">💾</button>
                    ` : ''}
                    ${!isCurrentUser ? `
                        <button onclick="window.adminPanel.muteUser('${user.UserId}', 5)" title="Заглушить">🔇</button>
                        <button onclick="window.adminPanel.kickUser('${user.UserId}')" title="Выгнать">🚪</button>
                        ${user.Status === 'banned' 
                            ? `<button onclick="window.adminPanel.unbanUser('${user.UserId}')" title="Разбанить">✅</button>`
                            : `<button onclick="window.adminPanel.banUser('${user.UserId}')" title="Забанить">⛔</button>`
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
     * Изменение роли пользователя
     * Добавлено в 5.1.
     */
    async changeUserRole(userId, newRole) {
        if (!confirm(`Изменить роль пользователя на ${newRole}?`)) return;

        try {
            const result = await this.app.apiService.setUserRole(userId, {
                //userId: userId,
                //Role: role,
                //ModeratorId: this.app.multiUserManager.localUser.Id
                role: newRole,
                moderatorId: this.app.multiUserManager.localUser.Id                
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
     * Загрузка всех данных для пользователей только
     */
    // === 5.3 Обновлённый метод загрузки пользователей ===      
    // Добавлено в 5.4: вызов renderUserPagination после загрузки
    async loadUserData() {                 /* Изменено в 5.3 */
        // Показываем индикатор загрузки
        this.showLoading();        
        try {
            // Загружаем всё параллельно
            /* Удалено 5.3
            const [users] = await Promise.all([
                this.app.apiService.getAllUsers().catch(() => ({ success: false })),

            ]);
            if (users.success) this.users = users.users || [];
            */
            const result = await this.app.apiService.getUsersPaginated(
                this.userPage,
                this.userPageSize,
                this.userSearch
            );    
            if (result.success) {
                this.users = result.data || [];
                this.userTotal = result.pagination?.total || 0;
                this.renderUsers();
                this.renderUserPagination(); // Добавлено 5.4
            }                   
            // Рендерим текущую вкладку
            //this.renderCurrentTab(); //Удалено 5.3

        } catch (error) {
            console.error('Ошибка загрузки данных пользователей:', error);            
            this.app.toast.error('❌ Ошибка загрузки данных админки для пользователей');
        } finally {
            this.hideLoading();
        }
    }

    /* Добавлено в 5.3 */
    renderUserPagination() {
        const container = document.getElementById('adminUserPagination');
        if (!container) return;
        const totalPages = Math.ceil(this.userTotal / this.userPageSize);
        container.innerHTML = `
            <button ${this.userPage <= 1 ? 'disabled' : ''} onclick="window.adminPanel.goToUserPage(${this.userPage - 1})">◀</button>
            <span>Стр. ${this.userPage} из ${totalPages || 1}</span>
            <button ${this.userPage >= totalPages ? 'disabled' : ''} onclick="window.adminPanel.goToUserPage(${this.userPage + 1})">▶</button>
            <input type="text" id="adminUserSearchPage" placeholder="Поиск..." value="${this.userSearch}">
            <button onclick="window.adminPanel.searchUsers()">🔍</button>
        `;
    }

    /* Добавлено в 5.3 */
    goToUserPage(page) {
        this.userPage = page;
        this.loadUserData();
    }

    /* Добавлено в 5.3 */
    searchUsers() {
        const input = document.getElementById('adminUserSearchPage');
        if (input) {
            this.userSearch = input.value.trim();
            this.userPage = 1;
            this.loadUserData();
        }
    }

    // === Расширенный поиск: сохранение в URL ===
    /* Добавлено в 5.3 */
    _updateURL() {
        const params = new URLSearchParams();
        const query = document.getElementById('adminMsgQuery')?.value;
        const room = document.getElementById('adminMsgRoom')?.value;
        const user = document.getElementById('adminMsgUser')?.value;
        const from = document.getElementById('adminMsgDateFrom')?.value;
        const to = document.getElementById('adminMsgDateTo')?.value;
        if (query) params.set('q', query);
        if (room) params.set('room', room);
        if (user) params.set('user', user);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        params.set('offset', this.searchOffset);
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        history.pushState({}, '', newUrl);
    }

    /* Добавлено в 5.3 */
    _loadFromURL() {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        const room = params.get('room');
        const user = params.get('user');
        const from = params.get('from');
        const to = params.get('to');
        const offset = parseInt(params.get('offset')) || 0;
        if (query) document.getElementById('adminMsgQuery').value = query;
        if (room) document.getElementById('adminMsgRoom').value = room;
        if (user) document.getElementById('adminMsgUser').value = user;
        if (from) document.getElementById('adminMsgDateFrom').value = from;
        if (to) document.getElementById('adminMsgDateTo').value = to;
        this.searchOffset = offset;
        this.loadMessagesWithFilters();
    }

    /**
     * Загрузка всех данных для комнат только
     */
    async loadRoomData() {
        // Показываем индикатор загрузки
        this.showLoading();        
        try {
            // Загружаем всё параллельно
            const [ rooms] = await Promise.all([
                this.app.apiService.getAdminRooms().catch(() => ({ success: false })),
            ]);

            if (rooms.success) this.rooms = rooms.rooms || [];
    
            // Рендерим текущую вкладку
            this.renderCurrentTab();

        } catch (error) {
            console.error('Ошибка загрузки данных комнат:', error);            
            this.app.toast.error('❌ Ошибка загрузки данных админки для комнат');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Рендеринг текущей вкладки
     */
    renderCurrentTab() {
        switch (this.currentTab) {
            case 'users':
                this.renderUsers();
                break;
            case 'rooms':
                this.renderRooms();
                break;
            case 'messages':
                this.renderSearchUI();
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

    // ===== ВКЛАДКА: КОМНАТЫ =====

    /**
     * Отображение комнат с возможностью управления
     * Изменено в 5.1: добавлены действия с комнатами
     */

        // ===== ВКЛАДКА: КОМНАТЫ (с изменениями для отображения пользователей) =====
    renderRooms() {

        const container = document.getElementById('adminRoomList');
        if (!container) return;

        // Удаляем все старые обработчики кликов, чтобы избежать дублирования
        //container.removeEventListener('click', this.handleRoomAction); // Предполагаем, что метод будет привязан к экземпляру

        if (!this.rooms || this.rooms.length === 0) {
container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-secondary);">💬 Комнат нет</div>`;            
            /* //ЗАменено в 5.2
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    💬 Комнат нет
                </div>
            `;
            */
            return;
        }

/*
                    <button class="admin-room-clear" data-room-id="${room.RoomId}" title="Очистить историю">🗑️</button>
                    <button class="admin-room-delete" data-room-id="${room.RoomId}" title="Удалить комнату">❌</button>
                    <button class="admin-room-close" data-room-id="${room.RoomId}" title="Закрыть комнату">🔒</button>
                    <button class="admin-room-export" data-room-id="${room.RoomId}" title="Экспортировать">💾</button>

*/

        container.innerHTML = this.rooms.map(room => {
            const roomId = room.RoomId || room.id;
            const userCount = room.UserCount || room.userCount || 0;
            const isExpanded = this.expandedRooms.has(roomId);
            // Кэшированные пользователи            
            const cachedUsers = this.roomUsersCache.get(roomId);
            const usersHtml = cachedUsers ? this.renderRoomUsersHTML(roomId, cachedUsers) : '';

            return `
                <div class="admin-room-item" data-room-id="${roomId}">
                    <div class="admin-room-info">
                        <span class="admin-room-name">💬 ${sanitizeHTML(room.Name || room.RoomId)}</span>
                        <span class="admin-room-users" data-room-id="${roomId}" style="cursor:pointer;" title="Кликните для просмотра пользователей">
                            👥 ${userCount}
                        </span>
                        <span class="admin-room-messages">💬 ${room.MessageCount || 0}</span>
                        <span class="admin-room-status ${room.IsActive ? 'active' : 'inactive'}">
                            ${room.IsActive ? '🟢 Активна' : '⚪ Неактивна'}
                        </span>
                    </div>
                    <div class="admin-room-actions">
                        <button class="admin-room-clear" data-room-id="${roomId}" title="Очистить историю">🗑️</button>
                        <button class="admin-room-delete" data-room-id="${roomId}" title="Удалить комнату">❌</button>
                        <button class="admin-room-close" data-room-id="${roomId}" title="Закрыть комнату">🔒</button>
                        <button class="admin-room-export" data-room-id="${roomId}" title="Экспортировать">💾</button>
                    </div>
                    <div id="room-users-${roomId}" class="room-users-list" style="${isExpanded ? 'display:block;' : 'display:none;'}">
                        ${isExpanded ? usersHtml : ''}
                    </div>
                </div>
            `;
        }).join('');

        /* //Заменено в 5.2
        container.innerHTML = this.rooms.map(room => `
            <div class="admin-room-item">
                <div class="admin-room-info">
                    <span class="admin-room-name">💬 ${sanitizeHTML(room.Name || room.RoomId)}</span>
                    <span class="admin-room-users">👥 ${room.UserCount || 0}</span>
                    <span class="admin-room-messages">💬 ${room.MessageCount || 0}</span>
                    <span class="admin-room-status ${room.IsActive ? 'active' : 'inactive'}">
                        ${room.IsActive ? '🟢 Активна' : '⚪ Неактивна'}
                    </span>
                </div>
                <div class="admin-room-actions">
                    <button class="admin-room-clear" onclick="window.adminPanel.clearRoom('${room.RoomId || room.id}')" title="Очистить историю">🗑️</button>
                    <button class="admin-room-delete" onclick="window.adminPanel.deleteRoom('${room.RoomId || room.id}')" title="Удалить комнату">❌</button>
                    <button class="admin-room-close" onclick="window.adminPanel.closeRoom('${room.RoomId || room.id}')" title="Закрыть комнату">🔒</button>
                    <button class="admin-room-export" onclick="window.adminPanel.exportRoom('${room.RoomId || room.id}')" title="Экспортировать">💾</button>
                </div>
            </div>
        `).join('');
        */

        // Обработчики кликов на количество пользователей (делегирование)
        container.querySelectorAll('.admin-room-users').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const roomId = el.dataset.roomId;
                this.toggleRoomUsers(roomId);
            });
        });
          
        // Добавляем один обработчик событий на контейнер (делегирование)
        //container.addEventListener('click', this.handleRoomAction.bind(this));   
             
        /*
        container.addEventListener('click', async (event) => {
            if (event.target.classList.contains('admin-room-delete')) {
                const roomId = event.target.dataset.roomId;
                await this.deleteRoom(roomId);
                await this.loadData();
            }
        });

        container.addEventListener('click', async (event) => {
            if (event.target.classList.contains('admin-room-close')) {
                const roomId = event.target.dataset.roomId;
                await this.closeRoom(roomId);
                await this.loadData();
            }
        });    
        
        container.addEventListener('click', async (event) => {
            if (event.target.classList.contains('admin-room-clear')) {
                const roomId = event.target.dataset.roomId;
                await this.clearRoom(roomId);
                await this.loadData();
            }
        });          
        
        container.addEventListener('click', async (event) => {
            if (event.target.classList.contains('admin-room-export')) {
                const roomId = event.target.dataset.roomId;
                await this.exportRoom(roomId);
                await this.loadData();
            }
        });    
        */      

        // Обработчики кнопок действий (делегирование)
        container.addEventListener('click', this.handleRoomAction);        
    }

    // ===== МЕТОДЫ ДЛЯ СПИСКА ПОЛЬЗОВАТЕЛЕЙ В КОМНАТЕ =====
    async toggleRoomUsers(roomId) {
        const container = document.getElementById(`room-users-${roomId}`);
        if (!container) return;

        if (this.expandedRooms.has(roomId)) {
            // Свернуть
            this.expandedRooms.delete(roomId);
            container.style.display = 'none';
            return;
        }

        // Развернуть
        this.expandedRooms.add(roomId);
        container.style.display = 'block';

        // Проверить кэш
        let users = this.roomUsersCache.get(roomId);
        if (users) {
            container.innerHTML = this.renderRoomUsersHTML(roomId, users);
            return;
        }

        // Загрузить
        container.innerHTML = '<div class="loading-users">⏳ Загрузка...</div>';
        try {
            users = await this.loadRoomUsers(roomId);
            this.roomUsersCache.set(roomId, users);
            container.innerHTML = this.renderRoomUsersHTML(roomId, users);
        } catch (error) {
            container.innerHTML = `<div class="error-users">❌ Ошибка загрузки: ${error.message}</div>`;
        }
    }

    //Изменео в 5.4 
    async loadRoomUsers(roomId) {
        // Исправлено в 5.4: замена getAdminRoomInfo на getAdminRoom
        const result = await this.app.apiService.getAdminRoom(roomId);
        if (result.success && result.room) {
            return result.room.users || [];
        }
        throw new Error(result.error || 'Не удалось загрузить пользователей');
    }

    renderRoomUsersHTML(roomId, users) {
        if (!users || users.length === 0) {
            return '<div class="no-users">👤 Нет пользователей в комнате</div>';
        }
        let html = `
            <table class="room-users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Онлайн</th>
                        <th>Роль</th>
                    </tr>
                </thead>
                <tbody>
        `;
        users.forEach(user => {
            const online = user.IsOnline || user.isOnline ? '✅' : '❌';
            const role = user.Role || user.role || 'User';
            html += `
                <tr>
                    <td>${sanitizeHTML(user.Id || user.id)}</td>
                    <td>${sanitizeHTML(user.Name || user.name)}</td>
                    <td>${online}</td>
                    <td>${sanitizeHTML(role)}</td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
        return html;
    }

    // ===== ВКЛАДКА: СООБЩЕНИЯ (расширенный поиск) =====
    // Добавлено в 5.2: форма фильтров и пагинация
    // 5.3 Обновлённый renderSearchUI
    /* Добавлено в 5.3: вызываем при открытии вкладки сообщений */        
    renderSearchUI() {
        const container = document.getElementById('tab-messages');
        if (!container) return;

        // Если форма фильтров уже есть, не добавляем повторно
        let filters = container.querySelector('.admin-search-filters');
        if (!filters) {
            filters = document.createElement('div');
            filters.className = 'admin-search-filters';
            filters.innerHTML = `
                <div class="filter-row">
                    <input type="text" id="adminMsgQuery" placeholder="🔍 Текст сообщения..." class="filter-input">
                    <select id="adminMsgRoom" class="filter-select"></select>
                    <select id="adminMsgUser" class="filter-select"></select>
                </div>
                <div class="filter-row">
                    <label>С: <input type="date" id="adminMsgDateFrom" class="filter-date"></label>
                    <label>По: <input type="date" id="adminMsgDateTo" class="filter-date"></label>
                    <button id="adminMsgSearchBtn" class="btn-primary">🔍 Искать</button>
                    <button id="adminMsgResetBtn" class="btn-secondary">↺ Сбросить</button>
                </div>
            `;
            // Вставляем перед списком сообщений
            const list = container.querySelector('.admin-message-list');
            container.insertBefore(filters, list);

            // Заполняем выпадающие списки
            this.populateRoomSelect();
            this.populateUserSelect();
            
            // После создания элементов, загружаем из URL
            // Добавлено 5.3
            this._loadFromURL();

            // Обработчики
            // При нажатии "Искать" вызываем _updateURL
            document.getElementById('adminMsgSearchBtn').addEventListener('click', () => {
                this.searchOffset = 0;
                this.loadMessagesWithFilters();
                // Добавлено 5.3
                this._updateURL(); 
            });
            // При сбросе тоже обновляем URL            
            document.getElementById('adminMsgResetBtn').addEventListener('click', () => {
                document.getElementById('adminMsgQuery').value = '';
                document.getElementById('adminMsgRoom').value = '';
                document.getElementById('adminMsgUser').value = '';
                document.getElementById('adminMsgDateFrom').value = '';
                document.getElementById('adminMsgDateTo').value = '';
                this.searchOffset = 0;
                this.loadMessagesWithFilters();
                // Добавлено 5.3                
                this._updateURL();                
            });
        }

        //Добавлено 5.3 (начало)
        // Добавляем кнопки экспорта 
        const exportDiv = document.createElement('div');
        exportDiv.className = 'export-buttons';
        exportDiv.innerHTML = `
            <button onclick="window.adminPanel.exportSearchResults('json')">📥 JSON</button>
            <button onclick="window.adminPanel.exportSearchResults('csv')">📥 CSV</button>
            <button onclick="window.adminPanel.exportSearchResults('txt')">📥 TXT</button>
        `;
        const list = container.querySelector('.admin-message-list');
        container.insertBefore(exportDiv, list);
        //Добавлено 5.3 (окончание)

        // Пагинация
        /* //Удалено 5.3
        let pagination = container.querySelector('.admin-search-pagination');
        if (!pagination) {
            pagination = document.createElement('div');
            pagination.className = 'admin-search-pagination';
            pagination.id = 'adminMsgPagination';
            container.appendChild(pagination);
        }
        this.renderPagination();
        */
    }

   /* Добавлено в 5.3 */
    async exportSearchResults(format = 'json') {
        const query = document.getElementById('adminMsgQuery')?.value || '';
        const roomId = document.getElementById('adminMsgRoom')?.value || '';
        const userId = document.getElementById('adminMsgUser')?.value || '';
        const dateFrom = document.getElementById('adminMsgDateFrom')?.value || '';
        const dateTo = document.getElementById('adminMsgDateTo')?.value || '';
        const params = { query, limit: 10000, offset: 0 };
        if (roomId) params.roomId = roomId;
        if (userId) params.userId = userId;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
        const result = await this.app.apiService.adminSearchMessages(params);
        if (!result.success) {
            this.app.toast.error('Ошибка получения данных');
            return;
        }
        const messages = result.results || [];
        let content = '';
        if (format === 'json') {
            content = JSON.stringify(messages, null, 2);
        } else if (format === 'csv') {
            const headers = ['id', 'userName', 'roomName', 'content', 'timestamp'];
            content = headers.join(',') + '\n';
            messages.forEach(m => {
                const row = headers.map(h => {
                    let val = m[h] || '';
                    if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                        val = `"${val.replace(/"/g, '""')}"`;
                    }
                    return val;
                });
                content += row.join(',') + '\n';
            });
        } else if (format === 'txt') {
            messages.forEach(m => {
                content += `${m.timestamp} - ${m.userName}: ${m.content}\n`;
            });
        }
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search_results.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        this.app.toast.success(`Экспортировано ${messages.length} сообщений`);
    }
        
    populateRoomSelect() {
        const select = document.getElementById('adminMsgRoom');
        if (!select) return;
        select.innerHTML = '<option value="">Все комнаты</option>';
        (this.rooms || []).forEach(room => {
            const opt = document.createElement('option');
            opt.value = room.RoomId || room.id;
            opt.textContent = room.Name || room.RoomId;
            select.appendChild(opt);
        });
    }    

    populateUserSelect() {
        const select = document.getElementById('adminMsgUser');
        if (!select) return;
        select.innerHTML = '<option value="">Все авторы</option>';
        (this.users || []).forEach(user => {
            const opt = document.createElement('option');
            opt.value = user.UserId || user.id;
            opt.textContent = user.Name || user.name;
            select.appendChild(opt);
        });
    }

    /**
     * Загрузка и поиск сообщений
     */
    async loadMessages() {
        const searchInput = document.getElementById('adminMsgSearch');
        const query = searchInput?.value || '';

        try {
            if (query.length < 2) {
                this.renderMessages([]);
                return;
            }

            const result = await this.app.apiService.adminSearchMessages({
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

    async loadMessagesWithFilters() {
        const query = document.getElementById('adminMsgQuery')?.value || '';
        const roomId = document.getElementById('adminMsgRoom')?.value || '';
        const userId = document.getElementById('adminMsgUser')?.value || '';
        const dateFrom = document.getElementById('adminMsgDateFrom')?.value || '';
        const dateTo = document.getElementById('adminMsgDateTo')?.value || '';

        const params = {
            query,
            limit: this.searchLimit,
            offset: this.searchOffset
        };
        if (roomId) params.roomId = roomId;
        if (userId) params.userId = userId;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const container = document.getElementById('adminMessageList');
        if (container) container.innerHTML = '<div class="loading-msg">⏳ Поиск...</div>';

        try {
            const result = await this.app.apiService.adminSearchMessages(params);
            if (result.success) {
                this.searchResults = result.results || [];
                this.searchTotal = result.total || 0;
                this.renderMessages(this.searchResults);
                this.renderPagination();
            } else {
                throw new Error(result.error || 'Ошибка поиска');
            }
        } catch (error) {
            if (container) container.innerHTML = `<div class="error-msg">❌ ${error.message}</div>`;
            this.app.toast.error('Ошибка поиска сообщений');
        }
    }

    /**
     * Отображение сообщений
     */
    renderMessages(messages) {
        const container = document.getElementById('adminMessageList');
        if (!container) return;

        const msgList = messages || this.searchResults || [];        
        //const msgList = messages || this.messages || []; // Заменено в 5.2

        if (msgList.length === 0) {
            /* // Заменено в 5.2
            container.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    📝 Введите запрос для поиска сообщений
                </div>
            `;
            */
           container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-secondary);">📝 Сообщения не найдены</div>`;
            return;
        }

        container.innerHTML = msgList.map(msg => `
            <div class="admin-message-item">
                <div class="admin-message-header">
                    <span class="admin-message-user">${sanitizeHTML(msg.userName || 'Unknown')}</span>
                    <span class="admin-message-room">${sanitizeHTML(msg.roomName || msg.roomId || '')}</span>
                    <span class="admin-message-time">${new Date(msg.timestamp).toLocaleString()}</span>
                    <button class="admin-message-delete" data-message-id="${msg.id}" title="Удалить">🗑️</button>
                </div>
                <div class="admin-message-content">${sanitizeHTML(msg.content)}</div>
            </div>
        `).join('');

        /* //Заменено в 5.2
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
        */

        // Обработчики удаления (делегирование)
        container.querySelectorAll('.admin-message-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.messageId;
                this.deleteMessage(id);
            });
        });       
    }

    renderPagination() {
        const container = document.getElementById('adminMsgPagination');
        if (!container) return;
        const totalPages = Math.ceil(this.searchTotal / this.searchLimit);
        const currentPage = Math.floor(this.searchOffset / this.searchLimit) + 1;

        container.innerHTML = `
            <button id="adminMsgPrev" ${this.searchOffset <= 0 ? 'disabled' : ''}>◀ Назад</button>
            <span>Страница ${currentPage} из ${totalPages || 1}</span>
            <button id="adminMsgNext" ${(this.searchOffset + this.searchLimit) >= this.searchTotal ? 'disabled' : ''}>Вперёд ▶</button>
        `;

        document.getElementById('adminMsgPrev')?.addEventListener('click', () => {
            if (this.searchOffset > 0) {
                this.searchOffset -= this.searchLimit;
                this.loadMessagesWithFilters();
            }
        });
        document.getElementById('adminMsgNext')?.addEventListener('click', () => {
            if ((this.searchOffset + this.searchLimit) < this.searchTotal) {
                this.searchOffset += this.searchLimit;
                this.loadMessagesWithFilters();
            }
        });
    }    
        
    // ===== ВКЛАДКА: СТАТИСТИКА =====

    /**
     * Отображение статистики
     */
    renderStats() {
        const container = document.getElementById('adminStats');
        if (!container) return;

        const stats = this.stats || {};

        container.innerHTML = `
            <div class="admin-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.TotalUsers || 0}</div>
                    <div class="stat-label">👥 Всего пользователей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.OnlineUsers || 0}</div>
                    <div class="stat-label">🟢 Онлайн</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.TotalRooms || 0}</div>
                    <div class="stat-label">💬 Комнат</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.TotalMessages || 0}</div>
                    <div class="stat-label">📝 Сообщений</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.PrivateMessages || 0}</div>
                    <div class="stat-label">🔒 Приватных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.BannedUsers || 0}</div>
                    <div class="stat-label">⛔ Забанено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.MutedUsers || 0}</div>
                    <div class="stat-label">🔇 Заглушено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.Timestamp ? new Date(stats.Timestamp).toLocaleString() : '—'}</div>
                    <div class="stat-label">⏱️ Время работы</div>
                </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">
                <button class="admin-stats-load" class="btn-secondary">🔄 Обновить</button>
                <button class="admin-stats-clear" class="btn-secondary" style="color:var(--error-color);">🗑️ Очистить всё</button>
            </div>
        `;

        container.addEventListener('click', (event) => {
            if (event.target.classList.contains('admin-stats-load')) {
                this.loadData();
            }
        });  
        
        container.addEventListener('click', (event) => {
            if (event.target.classList.contains('admin-stats-clear')) {
                this.clearAll();
            }
        });  

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
 
    /**
     * Отображение логов модерации
     */    
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
    
    /**
     * Рендеринг вкладки настроек с управлением ролями
     */
    // Фрагмент метода renderSettings (вставка в существующий метод)
    renderSettings() {
        const container = document.querySelector('.admin-settings-grid');
        if (!container) return;

        // Загружаем текущие настройки из localStorage
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
        // Исправлено в 5.4: повторная привязка обработчиков с проверкой существования элементов
        const saveBtn = document.getElementById('settingSaveBtn');
        if (saveBtn) {
            // Удаляем старые обработчики (если есть) и добавляем новые
            saveBtn.replaceWith(saveBtn.cloneNode(true));
            document.getElementById('settingSaveBtn').addEventListener('click', () => {
                this.saveSettings({
                    maxLength: parseInt(document.getElementById('settingMaxLength').value) || 10000,
                    maxUsers: parseInt(document.getElementById('settingMaxUsers').value) || 50,
                    inactiveTimeout: parseInt(document.getElementById('settingInactiveTimeout').value) || 5,
                    maxHistory: parseInt(document.getElementById('settingMaxHistory').value) || 1000,
                    autoClearRag: document.getElementById('settingAutoClearRag').value === 'true',
                    defaultRole: document.getElementById('defaultRoleSelect')?.value || 'User'
                });
                this.app.toast.success('✅ Настройки сохранены');
            });
        }

        const resetBtn = document.getElementById('settingResetBtn');
        if (resetBtn) {
            resetBtn.replaceWith(resetBtn.cloneNode(true));
            document.getElementById('settingResetBtn').addEventListener('click', () => {
                if (confirm('Сбросить настройки к значениям по умолчанию?')) {
                    this.resetSettings();
                    this.renderSettings();
                    this.app.toast.info('Настройки сброшены');
                }
            });
        }

        // Обработчики для управления ролями
        const defaultRoleSaveBtn = document.getElementById('defaultRoleSaveBtn');
        if (defaultRoleSaveBtn) {
            defaultRoleSaveBtn.replaceWith(defaultRoleSaveBtn.cloneNode(true));
            document.getElementById('defaultRoleSaveBtn').addEventListener('click', () => this.saveDefaultRole());
        }

        const roleStatsBtn = document.getElementById('roleStatsBtn');
        if (roleStatsBtn) {
            roleStatsBtn.replaceWith(roleStatsBtn.cloneNode(true));
            document.getElementById('roleStatsBtn').addEventListener('click', () => this.loadRoleStats());
        }        
    }

    /**
     * Загрузка настроек из localStorage
     */
    loadSettings() {
        try {
            const data = localStorage.getItem('admin_settings');
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    /**
     * Сохранение настроек
     */
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

    /**
     * Сброс настроек
     */
    resetSettings() {
        try {
            localStorage.removeItem('admin_settings');
        } catch (error) {
            console.error('Ошибка сброса настроек:', error);
        }
    }

    /* УБРАНО в 5.1
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    */
    // ===== ДЕЙСТВИЯ МОДЕРАТОРА (без изменений) =====

    /**
     * Заглушить пользователя
     * Добавлено в 5.1.
     */
    async muteUser(userId, minutes) {
        if (!confirm(`Заглушить пользователя на ${minutes} минут?`)) return;
        
        try {
            const result = await this.app.apiService.muteUser({
                userId: userId,
                minutes: minutes,
                moderatorId: this.app.multiUserManager.localUser.Id,
                reason: prompt('Причина (опционально):') || undefined
            });
            if (result.success) {
            this.app.toast.success(`🔇 Пользователь заглушен на ${minutes} минут`);
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка мута');
        }
    }

    /**
     * Выгнать пользователя из комнаты
     * Добавлено в 5.1.
     */
    async kickUser(userId) {
        if (!confirm('Выгнать пользователя?')) return;
        
        try {
            const result = await this.app.apiService.kickUser({
                userId: userId,
                roomId: this.app.multiUserManager.roomId,
                moderatorId: this.app.multiUserManager.localUser.Id
            });
            if (result.success) {
            this.app.toast.success('🚪 Пользователь выгнан');
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка кика');
        }
    }

    /**
     * Забанить пользователя
     * Добавлено в 5.1.
     */
    async banUser(userId) {
        if (!confirm('Забанить пользователя?')) return;
        
        try {
            const result = await this.app.apiService.banUser({
                userId: userId,
                moderatorId: this.app.multiUserManager.localUser.Id,
                reason: prompt('Причина бана:') || 'Нарушение правил'
            });
            if (result.success) {
            this.app.toast.success('⛔ Пользователь забанен');
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка бана');
        }
    }

    /**
     * Разбанить пользователя
     * Добавлено в 5.1.
     */
    async unbanUser(userId) {
        if (!confirm('Разбанить пользователя?')) return;

        try {
            const result = await this.app.apiService.unbanUser({
                userId: userId,
                moderatorId: this.app.multiUserManager.localUser.Id
            });
            if (result.success) {
                this.app.toast.success('✅ Пользователь разбанен');
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка разбана');
        }
    }

    //Назначить Админом
    async setAdmin(userId, set) {
        try {
            const result = await this.app.multiUserManager.api.setUserRole(userId, {
                role: 'admin',
                set: set
            });
            if (result.success) {
                this.app.toast.success(`🛡️ Админ ${set ? 'назначен' : 'снят'}`);
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }

    //Назначить Модератором
    async setModerator(userId, set) {
        try {
            const result = await this.app.multiUserManager.api.setUserRole(userId, {
                role: 'moderator',
                set: set
            });
            if (result.success) {
                this.app.toast.success(`🔧 Модератор ${set ? 'назначен' : 'снят'}`);
                await this.loadUserData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка');
        }
    }


    // ===== ДЕЙСТВИЯ С КОМНАТАМИ (без изменений) =====

    /**
     * Очистить историю комнаты
     * Добавлено в 5.1.
     */
    async clearRoom(roomId) {
        if (!confirm('Очистить историю комнаты?')) return;
        
        try {
            const result = await this.app.apiService.clearRoomHistory({ roomId });
            /*
            const result = await this.app.multiUserManager.api.clearRoomHistory({
                roomId: roomId
            });
            */
            if (result.success) {
                this.app.toast.success('🗑️ История очищена');
                //Может надо закрыть?
                await this.loadRoomData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка очистки');
        }
    }

    /**
     * Удалить комнату
     * Добавлено в 5.1.
     */
    async deleteRoom(roomId) {
        if (!confirm('Удалить комнату?')) return;
        
        try {
            /*
            const result = await this.app.multiUserManager.api.deleteRoom({
                roomId: roomId
            });
            */
            const result = await this.app.apiService.deleteRoom({ roomId });           
            if (result.success) {
                this.app.toast.success('❌ Комната удалена');
                //Может надо закрыть?
                await this.loadRoomData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка удаления комнаты');
        }
    }

    /**
     * Закрыть комнату
     * Добавлено в 5.1.
     */
    async closeRoom(roomId) {
        if (!confirm('Закрыть комнату?')) return;

        try {
            const result = await this.app.apiService.closeRoom({ roomId });            
            /*
            const result = await this.app.multiUserManager.api.closeRoom({
                roomId: roomId
            });
            */
            if (result.success) {
                this.app.toast.success('🔒 Комната закрыта');
                //Может надо закрыть?
                await this.loadRoomData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка закрытия комнаты');
        }
    }    

    /**
     * Экспортировать комнату
     * Добавлено в 5.1.
     */
    async exportRoom(roomId) {
        try {
            const result = await this.app.apiService.exportRoom(roomId, 'json');
            if (result.success) {
                // Создаем файл для скачивания
                //const data = result.data || result.data1;
                const data = result.data || result;
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

    // ===== ДЕЙСТВИЯ С СООБЩЕНИЯМИ (без изменений) =====

    /**
     * Удалить сообщение (админ)
     * Добавлено в 5.1.
     */
    async deleteMessage(messageId) {
        if (!confirm('Удалить сообщение?')) return;

        try {
            const result = await this.app.apiService.adminDeleteMessage(messageId);
            /*
            const result = await this.app.multiUserManager.api.deleteMessage(
                null, // roomId не нужен для админского удаления
                messageId,
                this.app.multiUserManager.localUser.Id
            );
            */
            if (result.success) {
                this.app.toast.success('🗑️ Сообщение удалено');
                // Обновляем список сообщений
                this.messages = this.messages.filter(m => m.id !== messageId);
                this.renderMessages();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка удаления сообщения');
        }
    }

    // ===== ОЧИСТКА ВСЕХ ДАННЫХ =====    
    /**
     * Очистить все данные
     * Добавлено в 5.1.
     * Это действие необратимо!
     */
    async clearAll() {
        if (!confirm('⚠️ Очистить все данные? Это действие необратимо!')) return;
        if (!confirm('Вы уверены?')) return;

        try {
            const result = await this.app.apiService.clearAllData();
            if (result.success) {
                this.app.toast.success('🗑️ Все данные очищены');
                await this.loadData();
            }
        } catch (error) {
            this.app.toast.error('❌ Ошибка очистки');
        }
    }    

    // ===== НАСТРОЙКА ОБРАБОТЧИКОВ (добавлена обработка для поиска) =====

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Открытие
        document.getElementById('adminBtn')?.addEventListener('click', () => this.open());

        // Закрытие
        document.getElementById('adminModalClose')?.addEventListener('click', () => this.close());

        // Обновление
        document.getElementById('adminRefreshBtn')?.addEventListener('click', () => this.loadData());

        // Поиск сообщений (старый обработчик заменяем на новый)
        // Удаляем старые, добавляем новые
        const oldSearchBtn = document.getElementById('adminMsgSearchBtn');
        if (oldSearchBtn) {
            oldSearchBtn.removeEventListener('click', this.loadMessages);
        }        
        // Новый обработчик будет добавлен в renderSearchUI    

        /*   
        //Закрыли в 5.2
        document.getElementById('adminMsgSearchBtn')?.addEventListener('click', () => {
            this.loadMessages();
        });

        document.getElementById('adminMsgSearch')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.loadMessages();
            }
        });
        */

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

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====

    /**
     * Показать индикатор загрузки
     */
    showLoading() {
        // Можно добавить индикатор загрузки
        // Создаем элемент индикатора загрузки, если он еще не существует
        let loadingElement = document.getElementById('loadingStatsIndicator');
        
        // Если элемент не найден, создаем его
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'loadingStatsIndicator';
            
            // Создаем элемент для отображения анимации загрузки (круглый спиннер)
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            
            // Добавляем спиннер в контейнер
            loadingElement.appendChild(spinner);
            
            // Добавляем стили для индикатора загрузки
            const style = document.createElement('style');
            style.textContent = `
                #loadingStatsIndicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                }
                
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            
            document.head.appendChild(style);
            document.body.appendChild(loadingElement);
        }
        
        // Показываем индикатор загрузки
        loadingElement.style.display = 'flex';

    }

    /**
     * Скрыть индикатор загрузки
     */
    hideLoading() {
        // Скрыть индикатор загрузки
        // Ищет элемент индикатора загрузки по ID
        const d = document.getElementById('loadingStatsIndicator');

        // Проверяет, существует ли элемент перед попыткой его скрыть
            // Применяет анимацию исчезновения
            // Удаляет элемент после завершения анимации (через 300мс)
        if (d) { d.style.animation = 'fadeOut 0.3s ease'; setTimeout(() => d.remove(), 300); }        
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

    // ===== ОБРАБОТЧИК ДЕЙСТВИЙ С КОМНАТАМИ (делегирование) =====    
    // Объявляем метод для делегирования действий
    handleRoomAction(event) {
        const target = event.target;

        if (target.classList.contains('admin-room-delete')) {
            const roomId = target.dataset.roomId;
            this.deleteRoom(roomId).then(() => this.loadData());
        } else if (target.classList.contains('admin-room-close')) {
            const roomId = target.dataset.roomId;
            this.closeRoom(roomId).then(() => this.loadData());
        } else if (target.classList.contains('admin-room-clear')) {
            const roomId = target.dataset.roomId;
            this.clearRoom(roomId).then(() => this.loadData());
        } else if (target.classList.contains('admin-room-export')) {
            const roomId = target.dataset.roomId;
            this.exportRoom(roomId).then(() => this.loadData());
        }
    }      
}

// Для доступа из HTML
/*
window.adminPanel = null;
*/
// После определения класса:
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel(window.app);
});