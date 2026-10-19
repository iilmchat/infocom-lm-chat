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