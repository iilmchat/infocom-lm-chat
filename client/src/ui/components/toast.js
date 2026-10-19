// src/ui/components/toast.js
import { CONFIG } from '../../config.js';

/**
 * Менеджер всплывающих уведомлений (Toast)
 */
export class ToastManager {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
        this.maxToasts = CONFIG.UI_CONFIG.MAX_TOASTS || 5;
    }

    show(msg, type = 'info', dur = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.textContent = msg;

        this.container.appendChild(toast);

        while (this.container.children.length > this.maxToasts) {
            this.container.firstChild.remove();
        }

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, dur);
    }

    success(msg, duration = 3000) {
        this.show(msg, 'success', duration);
    }

    error(msg, duration = 4000) {
        this.show(msg, 'error', duration);
    }

    warning(msg, duration = 3000) {
        this.show(msg, 'warning', duration);
    }

    info(msg, duration = 3000) {
        this.show(msg, 'info', duration);
    }

    clear() {
        this.container.innerHTML = '';
    }

    setMaxToasts(max) {
        this.maxToasts = max;
    }
}