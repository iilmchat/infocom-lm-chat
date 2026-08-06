// src/ui/views/info-view.js
import { Modal } from '../components/modal.js';
import { CONFIG } from '../../config.js';

/**
 * Модальное окно с информацией (Вики, Предложения, Достижения)
 */
export class InfoView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('infoModal'));
        this.tabs = document.getElementById('infoModalTabs');
        this.currentTab = 'wiki';

        this.setupEventListeners();
    }

    open(tab = 'wiki') {
        this.switchTab(tab);
        this.modal.open();
        if (tab === 'achievements') {
            this.renderAchievements();
        }
    }

    close() {
        this.modal.close();
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Обновляем вкладки
        document.querySelectorAll('.modal-tab-content').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-selected', 'false');
        });
        
        document.querySelectorAll('#infoModalTabs button').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-selected', 'false');
        });
        
        const content = document.getElementById(`tab-${tab}`);
        if (content) {
            content.classList.add('active');
            content.setAttribute('aria-selected', 'true');
        }
        
        const button = document.querySelector(`#infoModalTabs button[data-tab="${tab}"]`);
        if (button) {
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
        }
        
        if (tab === 'achievements') {
            this.renderAchievements();
        }
    }

    renderAchievements() {
        const container = document.getElementById('achievementsList');
        const counter = document.getElementById('achievementCounter');
        const all = this.app.achievementManager.getAll();
        const unlocked = this.app.achievementManager.getUnlocked();
        
        if (counter) {
            counter.textContent = `${unlocked.length}/${all.length}`;
        }
        
        if (container) {
            container.innerHTML = all.map(a => `
                <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:${a.unlocked ? 'var(--bg-accent)' : 'var(--bg-primary)'};border-radius:8px;border:1px solid ${a.unlocked ? 'var(--gold-color)' : 'var(--border-color)'};opacity:${a.unlocked ? 1 : 0.6};margin-bottom:4px;">
                    <span style="font-size:24px;">${a.unlocked ? '🏆' : '🔒'}</span>
                    <div style="flex:1;">
                        <div style="font-weight:600;color:${a.unlocked ? 'var(--gold-color)' : 'var(--text-secondary)'};">${this.sanitizeHTML(a.name)}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">${this.sanitizeHTML(a.desc)}</div>
                    </div>
                    ${a.unlocked ? '<span style="color:var(--success-color);">✅</span>' : ''}
                </div>
            `).join('');
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    setupEventListeners() {
        // Кнопки открытия
        document.getElementById('wikiBtn')?.addEventListener('click', () => this.open('wiki'));
        document.getElementById('suggestionsBtn')?.addEventListener('click', () => this.open('suggestions'));
        document.getElementById('achievementsBtn')?.addEventListener('click', () => this.open('achievements'));

        // Закрытие
        document.getElementById('infoModalClose')?.addEventListener('click', () => this.close());

        // Переключение вкладок
        document.querySelectorAll('#infoModalTabs button').forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                // Используем глобальный app
                if (window.app && window.app.infoView) {
                    window.app.infoView.switchTab(tab);
                }
            });
        });

        // Закрытие по клику на overlay
        document.getElementById('infoModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('infoModal')) {
                this.close();
            }
        });
    }
}