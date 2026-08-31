// src/modules/stats/StatsModule.js
/* Добавлено в 6.1: модуль статистики и аналитики (полноэкранная страница) */

import { CONFIG } from '../../config.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

export class StatsModule {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.stats = null;
        this.period = CONFIG.ANALYTICS.DEFAULT_PERIOD || 'week';
        this.render();
        this.setupEventListeners();
        this.loadStats();
    }

    render() {
        this.container.innerHTML = `
            <div style="max-width:900px; margin:0 auto; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                    <h2>📊 Статистика и аналитика</h2>
                    <button id="statsBackBtn" class="btn btn-secondary" data-link="/">← Назад в чат</button>
                </div>

                <div class="stats-controls" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
                    <button class="btn btn-secondary btn-sm period-btn" data-period="day">День</button>
                    <button class="btn btn-secondary btn-sm period-btn active" data-period="week">Неделя</button>
                    <button class="btn btn-secondary btn-sm period-btn" data-period="month">Месяц</button>
                    <button id="statsRefreshBtn" class="btn btn-primary btn-sm" style="margin-left:auto;">🔄 Обновить</button>
                </div>

                <div id="statsGrid" class="stats-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:12px; margin-bottom:20px;">
                    <!-- Карточки будут заполнены динамически -->
                </div>

                <div id="statsCharts" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div class="chart-card" style="background:var(--bg-primary); border-radius:12px; padding:16px; border:1px solid var(--border-color);">
                        <h4 style="margin-bottom:8px;">📈 Активность по дням</h4>
                        <canvas id="activityChart" height="200"></canvas>
                    </div>
                    <div class="chart-card" style="background:var(--bg-primary); border-radius:12px; padding:16px; border:1px solid var(--border-color);">
                        <h4 style="margin-bottom:8px;">📊 Распределение сообщений</h4>
                        <canvas id="distributionChart" height="200"></canvas>
                    </div>
                </div>

                <div id="statsDetailed" style="margin-top:20px; background:var(--bg-primary); border-radius:12px; padding:16px; border:1px solid var(--border-color);">
                    <h4>📋 Детальная информация</h4>
                    <div id="statsDetails" style="font-size:14px; line-height:1.8; color:var(--text-secondary);">
                        Загрузка данных...
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Назад
        document.getElementById('statsBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });

        // Кнопки периода
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.period = btn.dataset.period;
                this.loadStats();
            });
        });

        // Обновить
        document.getElementById('statsRefreshBtn')?.addEventListener('click', () => {
            this.loadStats();
        });
    }

    async loadStats() {
        try {
            // Показываем индикатор загрузки
            const grid = document.getElementById('statsGrid');
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px;">⏳ Загрузка статистики...</div>';

            // Загружаем глобальную статистику
            const result = await this.app.apiService.getAdminStats();
            if (result.success) {
                this.stats = result.stats || {};
                this.renderStats();
                this.renderCharts();
                this.renderDetails();
            } else {
                throw new Error(result.error || 'Не удалось загрузить статистику');
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            document.getElementById('statsGrid').innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--error-color); padding:20px;">❌ Ошибка загрузки: ${error.message}</div>`;
            this.app.toast.error('Не удалось загрузить статистику');
        }
    }

    renderStats() {
        const grid = document.getElementById('statsGrid');
        const stats = this.stats;
        const items = [
            { label: '👥 Всего пользователей', value: stats.TotalUsers || 0 },
            { label: '🟢 Онлайн', value: stats.OnlineUsers || 0 },
            { label: '💬 Комнат', value: stats.TotalRooms || 0 },
            { label: '📝 Всего сообщений', value: stats.TotalMessages || 0 },
            { label: '🔒 Приватных', value: stats.PrivateMessages || 0 },
            { label: '⛔ Забанено', value: stats.BannedUsers || 0 },
            { label: '🔇 Заглушено', value: stats.MutedUsers || 0 },
            { label: '⏱️ Время работы', value: stats.Uptime ? new Date(stats.Uptime).toLocaleString() : '—' }
        ];

        grid.innerHTML = items.map(item => `
            <div class="stat-card" style="background:var(--bg-secondary); border-radius:12px; padding:16px; text-align:center; border:1px solid var(--border-color);">
                <div style="font-size:28px; font-weight:700; color:var(--text-accent);">${item.value}</div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${item.label}</div>
            </div>
        `).join('');
    }

    renderCharts() {
        // Для простоты используем canvas, но можно подключить chart.js
        // Здесь приведена заглушка – в реальном проекте рисуем графики
        const activityCanvas = document.getElementById('activityChart');
        const distCanvas = document.getElementById('distributionChart');
        if (activityCanvas) {
            const ctx = activityCanvas.getContext('2d');
            ctx.clearRect(0, 0, activityCanvas.width, activityCanvas.height);
            ctx.fillStyle = 'var(--text-secondary)';
            ctx.font = '14px sans-serif';
            ctx.fillText('📈 График активности (заглушка)', 10, 30);
            // Можно нарисовать простой график на основе stats, если есть данные
        }
        if (distCanvas) {
            const ctx = distCanvas.getContext('2d');
            ctx.clearRect(0, 0, distCanvas.width, distCanvas.height);
            ctx.fillStyle = 'var(--text-secondary)';
            ctx.font = '14px sans-serif';
            ctx.fillText('📊 Распределение сообщений (заглушка)', 10, 30);
        }
    }

    renderDetails() {
        const container = document.getElementById('statsDetails');
        const stats = this.stats;
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px 24px;">
                <div><strong>Всего пользователей:</strong> ${stats.TotalUsers || 0}</div>
                <div><strong>Онлайн:</strong> ${stats.OnlineUsers || 0}</div>
                <div><strong>Всего комнат:</strong> ${stats.TotalRooms || 0}</div>
                <div><strong>Всего сообщений:</strong> ${stats.TotalMessages || 0}</div>
                <div><strong>Приватных сообщений:</strong> ${stats.PrivateMessages || 0}</div>
                <div><strong>Забанено:</strong> ${stats.BannedUsers || 0}</div>
                <div><strong>Заглушено:</strong> ${stats.MutedUsers || 0}</div>
                <div><strong>Время работы:</strong> ${stats.Uptime ? new Date(stats.Uptime).toLocaleString() : '—'}</div>
                ${stats.Timestamp ? `<div><strong>Последнее обновление:</strong> ${new Date(stats.Timestamp).toLocaleString()}</div>` : ''}
            </div>
        `;
    }
}