// src/modules/admin/AdminModule.js
/**
 * Модуль администрирования
 * Добавлено в 6.0
 * Отвечает за загрузку и управление панелью администратора.
 */
import { AdminPanel } from '../../ui/views/admin-panel.js';

export class AdminModule {
    constructor(app) {
        this.app = app;
        this.adminPanel = null;
    }

    /**
     * Инициализация модуля – создание экземпляра AdminPanel и открытие
     */
    init() {
        /* Изменено в 6.2 (KI-053): в офлайн-режиме AdminPanel не создаём и не открываем —
           иначе панель сразу шлёт запросы на недоступный бэкенд (ERR_CONNECTION_REFUSED). */
        if (this.app.offlineMode) {
            const container = document.getElementById('app-admin');
            if (container) {
                container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-secondary);">🛑 Панель администратора недоступна в офлайн-режиме (нет связи с сервером).</div>';
            }
            return;
        }

        if (!this.adminPanel) {
            this.adminPanel = new AdminPanel(this.app);
        }
        this.adminPanel.open();
        return this;
    }

    /**
     * Очистка модуля (если требуется)
     */
    destroy() {
        if (this.adminPanel) {
            this.adminPanel.close();
        }
        // Можно также удалить ссылку, но оставим для возможности повторного открытия
    }
}