// src/core/error-boundary.js
import { ToastManager } from '../ui/components/toast.js';

/**
 * Глобальный перехват и отображение ошибок
 */
export class ErrorBoundary {
    constructor() {
        this.container = document.getElementById('errorBoundary');
        if (!this.container) {
            // Создаем контейнер, если его нет
            this.container = document.createElement('div');
            this.container.className = 'error-boundary';
            this.container.id = 'errorBoundary';
            document.body.appendChild(this.container);
        }
        this.errors = [];
        this.toast = new ToastManager();
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        window.onerror = (message, source, lineno, colno, error) => {
            this.addError({
                message: message,
                source: source,
                lineno: lineno,
                colno: colno,
                error: error,
                timestamp: Date.now()
            });
            return false;
        };

        window.addEventListener('unhandledrejection', (event) => {
            this.addError({
                message: event.reason?.message || 'Необработанное исключение в Promise',
                error: event.reason,
                timestamp: Date.now(),
                type: 'promise'
            });
            event.preventDefault();
        });

        // Перехват ошибок в консоли
        const originalConsoleError = console.error;
        console.error = (...args) => {
            originalConsoleError.apply(console, args);
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            if (!message.includes('ErrorBoundary')) {
                this.addError({
                    message: message,
                    timestamp: Date.now(),
                    type: 'console'
                });
            }
        };
    }

    addError(errorData) {
        const errorItem = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            ...errorData,
            message: errorData.message || 'Неизвестная ошибка'
        };

        this.errors.push(errorItem);
        this.renderError(errorItem);
        console.error('[ErrorBoundary]', errorItem);
        this.toast.error(errorItem.message, 5000);
    }

    renderError(error) {
        const div = document.createElement('div');
        div.className = 'error-item';
        div.dataset.id = error.id;

        const stack = error.error?.stack || error.stack || '';
        const safeMessage = this.sanitizeHTML(error.message);

        div.innerHTML = `
            <div class="error-title">⚠️ ${safeMessage}</div>
            ${error.source ? `<div class="error-message">📄 ${this.sanitizeHTML(error.source)} (${error.lineno}:${error.colno})</div>` : ''}
            ${stack ? `<div class="error-stack">${this.sanitizeHTML(stack)}</div>` : ''}
            <div class="error-actions">
                <button class="btn-dismiss">✕ Закрыть</button>
                ${stack ? `<button class="btn-details">📋 Подробности</button>` : ''}
            </div>
        `;

        div.querySelector('.btn-dismiss').onclick = () => {
            div.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => div.remove(), 300);
        };

        const detailsBtn = div.querySelector('.btn-details');
        if (detailsBtn) {
            const stackEl = div.querySelector('.error-stack');
            detailsBtn.onclick = () => {
                if (stackEl.style.display === 'block') {
                    stackEl.style.display = 'none';
                    detailsBtn.textContent = '📋 Подробности';
                } else {
                    stackEl.style.display = 'block';
                    detailsBtn.textContent = '📋 Скрыть';
                }
            };
        }

        this.container.appendChild(div);

        setTimeout(() => {
            if (div.parentNode) {
                div.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => div.remove(), 300);
            }
        }, 15000);
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    clear() {
        this.container.innerHTML = '';
        this.errors = [];
    }

    getAllErrors() {
        return [...this.errors];
    }
}