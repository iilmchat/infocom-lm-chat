// src/ui/views/auth-modal.js
import { Modal } from '../components/modal.js';

/**
 * Модальное окно для входа/регистрации
 */
export class AuthModal {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(this.createModalElement());
        this.onLogin = null;
        this.setupEventListeners();
    }

    createModalElement() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'authModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <button class="modal-close" id="authModalClose">✕</button>
                <h2 id="authTitle">🔐 Вход / Регистрация</h2>
                <div id="authForm">
                    <div class="form-group">
                        <label>Имя пользователя</label>
                        <input type="text" id="authName" placeholder="Введите имя..." maxlength="20" required>
                    </div>
                    <div class="form-group">
                        <label>Аватар (эмодзи)</label>
                        <input type="text" id="authAvatar" placeholder="😊" maxlength="2" value="😊">
                    </div>
                    <div class="form-group">
                        <label>Цвет</label>
                        <input type="color" id="authColor" value="#7ec8e3">
                    </div>
                    <div id="authError" style="color:var(--error-color);font-size:12px;margin-top:8px;display:none;"></div>
                    <div class="modal-actions" style="margin-top:16px;">
                        <button id="authLoginBtn" class="btn-primary">💾 Войти / Зарегистрироваться</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    open() {
        this.modal.open();
        document.getElementById('authName').focus();
    }

    close() {
        this.modal.close();
    }

    setupEventListeners() {
        document.getElementById('authModalClose').addEventListener('click', () => this.close());
        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('authModal')) this.close();
        });

        document.getElementById('authLoginBtn').addEventListener('click', async () => {
            const name = document.getElementById('authName').value.trim();
            const avatar = document.getElementById('authAvatar').value.trim() || '😊';
            const color = document.getElementById('authColor').value;

            if (!name) {
                this.showError('Введите имя пользователя');
                return;
            }

            try {
                const userData = {
                    userId: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
                    name,
                    avatar,
                    color
                };
                // Используем AuthService для регистрации
                const user = await this.app.authService.registerUser(userData);
                this.close();
                if (this.onLogin) this.onLogin(user);
                this.app.toast.success(`Добро пожаловать, ${user.name}!`);
                // Обновляем UI
                this.app.multiUserManager.localUser = user;
                this.app.multiUserManager.saveUser(user);
                this.app.multiUserManager.renderUsers();
                // Подключаемся к серверу
                this.app.multiUserManager.connectToServer();
            } catch (error) {
                this.showError(error.message || 'Ошибка регистрации');
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.isActive()) {
                this.close();
            }
        });
    }

    showError(msg) {
        const el = document.getElementById('authError');
        el.textContent = msg;
        el.style.display = 'block';
    }

    hideError() {
        document.getElementById('authError').style.display = 'none';
    }
}