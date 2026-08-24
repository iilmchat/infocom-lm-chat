// src/ui/views/analytics-view.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Модальное окно для отображения аналитики
 * Добавлено в 5.1.
 */
export class AnalyticsView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(this.createModalElement());
        this.currentTab = 'user'; // 'user', 'room', 'global'
        this.setupEventListeners();
    }

    createModalElement() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'analyticsModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-content" style="max-width:700px;max-height:80vh;overflow-y:auto;">
                <button class="modal-close" id="analyticsModalClose">✕</button>
                <h2>📊 Аналитика</h2>
                <div class="analytics-tabs">
                    <button class="analytics-tab active" data-tab="global">🌍 Глобальная</button>
                    <button class="analytics-tab" data-tab="user">👤 Пользователь</button>
                    <button class="analytics-tab" data-tab="room">💬 Комната</button>
                </div>
                <div id="analyticsContent" style="margin-top:12px;">
                    <div id="analyticsGlobal" class="analytics-panel active">
                        <div style="text-align:center;color:var(--text-secondary);">Загрузка глобальной статистики...</div>
                    </div>
                    <div id="analyticsUser" class="analytics-panel" style="display:none;">
                        <div class="form-group">
                            <label>ID пользователя</label>
                            <input type="text" id="analyticsUserId" placeholder="Введите ID пользователя">
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <input type="date" id="analyticsUserFrom">
                                <input type="date" id="analyticsUserTo">
                                <button id="analyticsUserLoadBtn" class="btn-primary">📊 Загрузить</button>
                            </div>
                        </div>
                        <div id="analyticsUserData" style="margin-top:12px;"></div>
                    </div>
                    <div id="analyticsRoom" class="analytics-panel" style="display:none;">
                        <div class="form-group">
                            <label>ID комнаты</label>
                            <input type="text" id="analyticsRoomId" placeholder="Введите ID комнаты">
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <input type="date" id="analyticsRoomFrom">
                                <input type="date" id="analyticsRoomTo">
                                <button id="analyticsRoomLoadBtn" class="btn-primary">📊 Загрузить</button>
                            </div>
                        </div>
                        <div id="analyticsRoomData" style="margin-top:12px;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    createModalElement__old() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'analyticsModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-content" style="max-width:700px;max-height:80vh;overflow-y:auto;">
                <button class="modal-close" id="analyticsModalClose">✕</button>
                <h2>📊 Аналитика</h2>
                <div class="analytics-tabs" style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border-color);padding-bottom:8px;">
                    <button class="analytics-tab active" data-tab="user" role="tab">👤 Пользователь</button>
                    <button class="analytics-tab" data-tab="room" role="tab">💬 Комната</button>
                    <button class="analytics-tab" data-tab="global" role="tab">🌍 Глобальная</button>
                </div>
                <div id="analyticsContent">
                    <div class="analytics-tab-content" id="tab-user">
                        <div class="form-group">
                            <label>ID пользователя</label>
                            <input type="text" id="analyticsUserId" placeholder="Введите ID пользователя">
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <label>С</label>
                                <input type="date" id="analyticsFrom">
                                <label>По</label>
                                <input type="date" id="analyticsTo">
                                <button id="analyticsUserLoad" class="btn-primary">📊 Загрузить</button>
                            </div>
                        </div>
                        <div id="analyticsUserData" style="margin-top:12px;"></div>
                    </div>
                    <div class="analytics-tab-content" id="tab-room" style="display:none;">
                        <div class="form-group">
                            <label>ID комнаты</label>
                            <input type="text" id="analyticsRoomId" placeholder="Введите ID комнаты">
                            <div style="display:flex;gap:8px;margin-top:8px;">
                                <label>С</label>
                                <input type="date" id="analyticsRoomFrom">
                                <label>По</label>
                                <input type="date" id="analyticsRoomTo">
                                <button id="analyticsRoomLoad" class="btn-primary">📊 Загрузить</button>
                            </div>
                        </div>
                        <div id="analyticsRoomData" style="margin-top:12px;"></div>
                    </div>
                    <div class="analytics-tab-content" id="tab-global" style="display:none;">
                        <button id="analyticsGlobalLoad" class="btn-primary">📊 Загрузить глобальную статистику</button>
                        <div id="analyticsGlobalData" style="margin-top:12px;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    createModalElement_new() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'analyticsModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-content" style="max-width:700px;max-height:80vh;overflow-y:auto;">
                <button class="modal-close" id="analyticsModalClose">✕</button>
                <h2>📊 Аналитика</h2>
                <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
                    <button id="analyticsGlobalBtn" class="btn-secondary">🌍 Глобальная</button>
                    <button id="analyticsUserBtn" class="btn-secondary">👤 Пользователь</button>
                    <button id="analyticsRoomBtn" class="btn-secondary">💬 Комната</button>
                </div>
                <div id="analyticsContent" style="min-height:200px;">
                    <p style="color:var(--text-secondary);">Выберите тип аналитики</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    open() {
        this.modal.open();
        this.loadGlobalAnalytics();
        //this.showGlobal();        
    }
    open_old() {
        this.modal.open();
        // По умолчанию показываем вкладку пользователя
        this.switchTab('user');
    }

    close() {
        this.modal.close();
    }

    async showGlobal() {
        const container = document.getElementById('analyticsContent');
        container.innerHTML = '<div style="text-align:center;padding:20px;">⏳ Загрузка...</div>';
        try {
            const result = await this.app.apiService.getGlobalAnalytics();
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="stat-card">
                            <div class="stat-number">${data.totalUsers || 0}</div>
                            <div class="stat-label">👥 Всего пользователей</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.activeUsers || 0}</div>
                            <div class="stat-label">🟢 Активных (сегодня)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.totalRooms || 0}</div>
                            <div class="stat-label">💬 Комнат</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.totalMessages || 0}</div>
                            <div class="stat-label">📝 Всего сообщений</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.messagesPerDay || 0}</div>
                            <div class="stat-label">📈 Сообщений в день (сред.)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.topRoom?.name || '—'}</div>
                            <div class="stat-label">🏆 Самая активная комната</div>
                        </div>
                    </div>
                    <div style="margin-top:16px;font-size:12px;color:var(--text-secondary);">
                        <div>📅 Период: ${data.period?.from || '—'} — ${data.period?.to || '—'}</div>
                        <div>🕒 Обновлено: ${data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—'}</div>
                    </div>
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки: ${error.message}</div>`;
        }
    }

    async showUserActivity(userId = null) {
        const targetUserId = userId || this.app.multiUserManager.localUser.id;
        const container = document.getElementById('analyticsContent');
        container.innerHTML = '<div style="text-align:center;padding:20px;">⏳ Загрузка...</div>';
        try {
            const from = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
            const to = new Date().toISOString().split('T')[0];
            const result = await this.app.apiService.getUserActivity(targetUserId, from, to);
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="stat-card">
                            <div class="stat-number">${data.messageCount || 0}</div>
                            <div class="stat-label">💬 Сообщений</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.roomsJoined || 0}</div>
                            <div class="stat-label">🚪 Комнат</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.reactionsGiven || 0}</div>
                            <div class="stat-label">❤️ Реакций</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.lastActive ? new Date(data.lastActive).toLocaleDateString() : '—'}</div>
                            <div class="stat-label">🕒 Последняя активность</div>
                        </div>
                    </div>
                    ${data.dailyActivity ? `
                        <div style="margin-top:12px;font-size:12px;color:var(--text-secondary);">
                            <div>📊 Активность по дням:</div>
                            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                                ${Object.entries(data.dailyActivity).slice(-7).map(([date, count]) => `
                                    <span style="background:var(--bg-accent);padding:2px 8px;border-radius:12px;">${date}: ${count}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки: ${error.message}</div>`;
        }
    }

    async showRoomEngagement(roomId = null) {
        const targetRoomId = roomId || this.app.multiUserManager.roomId;
        if (!targetRoomId) {
            document.getElementById('analyticsContent').innerHTML = '<div style="color:var(--text-secondary);">Вы не находитесь в комнате</div>';
            return;
        }
        const container = document.getElementById('analyticsContent');
        container.innerHTML = '<div style="text-align:center;padding:20px;">⏳ Загрузка...</div>';
        try {
            const from = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
            const to = new Date().toISOString().split('T')[0];
            const result = await this.app.apiService.getRoomEngagement(targetRoomId, from, to);
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="stat-card">
                            <div class="stat-number">${data.totalMessages || 0}</div>
                            <div class="stat-label">💬 Сообщений</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.uniqueUsers || 0}</div>
                            <div class="stat-label">👥 Участников</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.averageMessagesPerDay || 0}</div>
                            <div class="stat-label">📈 В день (сред.)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-number">${data.topUser?.name || '—'}</div>
                            <div class="stat-label">🏆 Самый активный</div>
                        </div>
                    </div>
                    ${data.hourlyActivity ? `
                        <div style="margin-top:12px;font-size:12px;color:var(--text-secondary);">
                            <div>⏰ Активность по часам:</div>
                            <div style="display:flex;gap:2px;flex-wrap:wrap;margin-top:4px;">
                                ${Object.entries(data.hourlyActivity).slice(0, 24).map(([hour, count]) => `
                                    <span style="background:var(--bg-accent);padding:2px 6px;border-radius:4px;font-size:10px;">${hour}: ${count}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки: ${error.message}</div>`;
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        // Обновляем вкладки
        document.querySelectorAll('.analytics-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
            el.setAttribute('aria-selected', el.dataset.tab === tab);
        });
        document.querySelectorAll('.analytics-tab-content').forEach(el => {
            el.style.display = el.id === `tab-${tab}` ? 'block' : 'none';
        });
    }


    async loadUserAnalytics(userId, from, to) {
        const container = document.getElementById('analyticsUserData');
        if (!userId) {
            container.innerHTML = '<div style="color:var(--warning-color);">Введите ID пользователя</div>';
            return;
        }
        try {
            const result = await this.app.apiService.getUserActivity(userId, from, to);
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-number">${data.messageCount || 0}</div>
                            <div class="analytics-label">📝 Сообщений</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.roomsJoined || 0}</div>
                            <div class="analytics-label">💬 Комнат</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.averageMessagesPerDay || 0}</div>
                            <div class="analytics-label">📊 В день</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.lastActive ? new Date(data.lastActive).toLocaleDateString() : '—'}</div>
                            <div class="analytics-label">🕒 Последняя активность</div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки данных</div>`;
        }
    }

    async loadUserAnalytics_old() {
        const userId = document.getElementById('analyticsUserId').value.trim();
        const from = document.getElementById('analyticsFrom').value;
        const to = document.getElementById('analyticsTo').value;
        if (!userId) {
            this.app.toast.warning('Введите ID пользователя');
            return;
        }
        try {
            const result = await this.app.apiService.getUserActivity(userId, from, to);
            if (result.success) {
                this.renderUserData(result.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки аналитики пользователя:', error);
            this.app.toast.error('Не удалось загрузить данные');
        }
    }    

    renderUserData(data) {
        const container = document.getElementById('analyticsUserData');
        if (!data) {
            container.innerHTML = '<div class="analytics-empty">Нет данных</div>';
            return;
        }
        container.innerHTML = `
            <div class="analytics-card">
                <h4>Активность пользователя</h4>
                <div class="analytics-grid">
                    <div class="analytics-item">
                        <span class="label">Сообщений</span>
                        <span class="value">${data.messageCount || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Комнат</span>
                        <span class="value">${data.roomCount || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Активность (дней)</span>
                        <span class="value">${data.activeDays || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Сред. сообщений в день</span>
                        <span class="value">${data.avgMessagesPerDay || 0}</span>
                    </div>
                </div>
                ${data.dailyActivity ? `
                    <div style="margin-top:12px;">
                        <h5>Ежедневная активность</h5>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">
                            ${Object.entries(data.dailyActivity).map(([date, count]) => `
                                <span style="background:var(--bg-accent);padding:2px 6px;border-radius:4px;font-size:11px;">${date}: ${count}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async loadGlobalAnalytics() {
        const container = document.getElementById('analyticsGlobal');
        try {
            const result = await this.app.apiService.getGlobalAnalytics();
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-number">${data.totalUsers || 0}</div>
                            <div class="analytics-label">👥 Всего пользователей</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.activeUsers || 0}</div>
                            <div class="analytics-label">🟢 Активных</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.totalRooms || 0}</div>
                            <div class="analytics-label">💬 Комнат</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.totalMessages || 0}</div>
                            <div class="analytics-label">📝 Сообщений</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.messagesPerDay || 0}</div>
                            <div class="analytics-label">📊 Сообщений в день</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.activeRooms || 0}</div>
                            <div class="analytics-label">🔥 Активных комнат</div>
                        </div>
                    </div>
                    ${data.topUsers ? `
                        <div style="margin-top:16px;">
                            <h3>🏆 Топ пользователей</h3>
                            ${data.topUsers.map((u, i) => `
                                <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border-color);">
                                    <span>${i+1}. ${sanitizeHTML(u.name)}</span>
                                    <span>${u.messageCount} сообщений</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки глобальной статистики</div>`;
        }
    }

     async loadGlobalAnalytics_old() {
        try {
            const result = await this.app.apiService.getGlobalAnalytics();
            if (result.success) {
                this.renderGlobalData(result.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки глобальной статистики:', error);
            this.app.toast.error('Не удалось загрузить данные');
        }
    }

    renderGlobalData(data) {
        const container = document.getElementById('analyticsGlobalData');
        if (!data) {
            container.innerHTML = '<div class="analytics-empty">Нет данных</div>';
            return;
        }
        container.innerHTML = `
            <div class="analytics-card">
                <h4>Глобальная статистика</h4>
                <div class="analytics-grid">
                    <div class="analytics-item">
                        <span class="label">Всего пользователей</span>
                        <span class="value">${data.totalUsers || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Всего комнат</span>
                        <span class="value">${data.totalRooms || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Всего сообщений</span>
                        <span class="value">${data.totalMessages || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Онлайн пользователей</span>
                        <span class="value">${data.onlineUsers || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Сред. сообщений в день</span>
                        <span class="value">${data.avgDailyMessages || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Активных пользователей (7д)</span>
                        <span class="value">${data.activeUsers7d || 0}</span>
                    </div>
                </div>
                ${data.growth ? `
                    <div style="margin-top:12px;">
                        <h5>Рост за последние 7 дней</h5>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">
                            ${Object.entries(data.growth).map(([date, count]) => `
                                <span style="background:var(--bg-accent);padding:2px 6px;border-radius:4px;font-size:11px;">${date}: +${count}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async loadRoomAnalytics(roomId, from, to) {
        const container = document.getElementById('analyticsRoomData');
        if (!roomId) {
            container.innerHTML = '<div style="color:var(--warning-color);">Введите ID комнаты</div>';
            return;
        }
        try {
            const result = await this.app.apiService.getRoomEngagement(roomId, from, to);
            if (result.success) {
                const data = result.data;
                container.innerHTML = `
                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-number">${data.totalMessages || 0}</div>
                            <div class="analytics-label">📝 Всего сообщений</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.uniqueUsers || 0}</div>
                            <div class="analytics-label">👥 Уникальных пользователей</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.averageMessagesPerUser || 0}</div>
                            <div class="analytics-label">📊 В среднем на пользователя</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-number">${data.peakActivityTime || '—'}</div>
                            <div class="analytics-label">⏰ Пик активности</div>
                        </div>
                    </div>
                    ${data.topUsers ? `
                        <div style="margin-top:16px;">
                            <h3>👥 Активные пользователи комнаты</h3>
                            ${data.topUsers.map((u, i) => `
                                <div style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border-color);">
                                    <span>${i+1}. ${sanitizeHTML(u.name)}</span>
                                    <span>${u.messageCount} сообщений</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                `;
            }
        } catch (error) {
            container.innerHTML = `<div style="color:var(--error-color);">Ошибка загрузки данных</div>`;
        }
    }

   async loadRoomAnalytics_old() {
        const roomId = document.getElementById('analyticsRoomId').value.trim();
        const from = document.getElementById('analyticsRoomFrom').value;
        const to = document.getElementById('analyticsRoomTo').value;
        if (!roomId) {
            this.app.toast.warning('Введите ID комнаты');
            return;
        }
        try {
            const result = await this.app.apiService.getRoomEngagement(roomId, from, to);
            if (result.success) {
                this.renderRoomData(result.data);
            }
        } catch (error) {
            console.error('Ошибка загрузки аналитики комнаты:', error);
            this.app.toast.error('Не удалось загрузить данные');
        }
    }

    renderRoomData(data) {
        const container = document.getElementById('analyticsRoomData');
        if (!data) {
            container.innerHTML = '<div class="analytics-empty">Нет данных</div>';
            return;
        }
        container.innerHTML = `
            <div class="analytics-card">
                <h4>Вовлечённость в комнате</h4>
                <div class="analytics-grid">
                    <div class="analytics-item">
                        <span class="label">Сообщений</span>
                        <span class="value">${data.messageCount || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Участников</span>
                        <span class="value">${data.userCount || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Активных участников</span>
                        <span class="value">${data.activeUsers || 0}</span>
                    </div>
                    <div class="analytics-item">
                        <span class="label">Сообщений на участника</span>
                        <span class="value">${data.messagesPerUser || 0}</span>
                    </div>
                </div>
                ${data.topUsers ? `
                    <div style="margin-top:12px;">
                        <h5>Топ активных пользователей</h5>
                        <ul style="list-style:none;padding:0;">
                            ${data.topUsers.map(u => `
                                <li style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-color);">
                                    <span>${u.userName}</span>
                                    <span>${u.messageCount} сообщений</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    setupEventListeners() {
        // Закрытие
        document.getElementById('analyticsModalClose').addEventListener('click', () => this.close());
        document.getElementById('analyticsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('analyticsModal')) this.close();
        });

        // Вкладки
        document.querySelectorAll('.analytics-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Переключение вкладок (Пока закрыто, не ясно зачем)
                //this.switchTab(tab.dataset.tab);

                //Новая реализация
                document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.dataset.tab;
                document.querySelectorAll('.analytics-panel').forEach(p => p.style.display = 'none');
                const panel = document.getElementById(`analytics${target.charAt(0).toUpperCase() + target.slice(1)}`);
                if (panel) panel.style.display = 'block';
                if (target === 'global') this.loadGlobalAnalytics();
                this.currentTab = target;
            });
        });

        // Загрузка данных (Старая)
        document.getElementById('analyticsUserLoad').addEventListener('click', () => this.loadUserAnalytics_old());
        document.getElementById('analyticsRoomLoad').addEventListener('click', () => this.loadRoomAnalytics_old());
        document.getElementById('analyticsGlobalLoad').addEventListener('click', () => this.loadGlobalAnalytics_old());

        
        // Загрузка аналитики пользователя
        document.getElementById('analyticsUserLoadBtn').addEventListener('click', () => {
            const userId = document.getElementById('analyticsUserId').value.trim();
            const from = document.getElementById('analyticsUserFrom').value;
            const to = document.getElementById('analyticsUserTo').value;
            this.loadUserAnalytics(userId, from, to);
        });

        // Загрузка аналитики комнаты
        document.getElementById('analyticsRoomLoadBtn').addEventListener('click', () => {
            const roomId = document.getElementById('analyticsRoomId').value.trim();
            const from = document.getElementById('analyticsRoomFrom').value;
            const to = document.getElementById('analyticsRoomTo').value;
            this.loadRoomAnalytics(roomId, from, to);
        });

        // Кнопка в шапке

        // Кнопка в шапке для открытия аналитики    
        /*
        document.getElementById('analyticsBtn')?.addEventListener('click', () => this.open());    
        */
        const analyticsBtn = document.getElementById('analyticsBtn');
        if (analyticsBtn) {
            analyticsBtn.addEventListener('click', () => this.open());
        }

        //Что-то из NEW
        document.getElementById('analyticsGlobalBtn').addEventListener('click', () => this.showGlobal());
        document.getElementById('analyticsUserBtn').addEventListener('click', () => this.showUserActivity());
        document.getElementById('analyticsRoomBtn').addEventListener('click', () => this.showRoomEngagement());

    }
}