// src/ui/views/profile-modal.js
/* Добавлено в 5.3 */

import { Modal } from '../components/modal.js';

/**
 * Единое модальное окно для входа и управления профилем
 * Заменяет AuthModal и UserModal.
 */
export class ProfileModal {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(this.createModalElement());
        this.currentMode = 'login'; // 'login' или 'profile'
        this.setupEventListeners();
    }

    /**
     * Создаёт DOM-элемент модального окна
     * @returns {HTMLElement}
     */
    createModalElement() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'profileModal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-content" style="max-width:450px;">
                <button class="modal-close" id="profileModalClose">✕</button>
                <h2 id="profileTitle">👤 Ваш профиль</h2>
                
                <div class="user-preview" id="userPreview" style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--bg-primary);border-radius:12px;border:2px solid var(--text-accent);margin-bottom:16px;">
                    <span id="userPreviewAvatar" style="font-size:48px;">👤</span>
                    <div>
                        <div id="userPreviewName" style="font-size:18px;font-weight:600;">Пользователь</div>
                        <div id="userPreviewStatus" style="font-size:12px;color:var(--text-secondary);">Статус: онлайн</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="userNameInput" placeholder="Введите имя..." maxlength="20">
                </div>
                
                <div class="form-group">
                    <label>Аватар (эмодзи)</label>
                    <div class="avatar-presets" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">😊</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">😎</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🤖</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🦊</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🐱</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🐶</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🐼</span>
                        <span class="avatar-preset" style="font-size:28px;cursor:pointer;padding:4px 8px;border-radius:8px;border:2px solid transparent;transition:all 0.2s;">🦁</span>
                    </div>
                    <input type="text" id="userAvatarInput" placeholder="👤" maxlength="2" style="width:60px;">
                </div>
                
                <div class="form-group">
                    <label>Цвет</label>
                    <div class="color-presets" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                        <span class="color-preset-option selected" data-color="#7ec8e3" style="width:28px;height:28px;border-radius:50%;background:#7ec8e3;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#4caf50" style="width:28px;height:28px;border-radius:50%;background:#4caf50;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#9b4dca" style="width:28px;height:28px;border-radius:50%;background:#9b4dca;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#f0db4f" style="width:28px;height:28px;border-radius:50%;background:#f0db4f;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#dd0031" style="width:28px;height:28px;border-radius:50%;background:#dd0031;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#ff69b4" style="width:28px;height:28px;border-radius:50%;background:#ff69b4;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#ff9800" style="width:28px;height:28px;border-radius:50%;background:#ff9800;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                        <span class="color-preset-option" data-color="#00bcd4" style="width:28px;height:28px;border-radius:50%;background:#00bcd4;cursor:pointer;border:2px solid transparent;transition:all 0.2s;"></span>
                    </div>
                    <input type="color" id="userColorInput" value="#7ec8e3" style="width:60px;height:40px;border:none;border-radius:8px;cursor:pointer;">
                </div>
                
                <div id="authError" style="color:var(--error-color);font-size:12px;margin-top:8px;display:none;"></div>
                
                <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;">
                    <button class="btn-secondary" id="profileCancelBtn">Отмена</button>
                    <button class="btn-primary" id="profileActionBtn">💾 Войти / Сохранить</button>
                    <button class="btn-danger" id="profileLogoutBtn" style="display:none;">🚪 Выйти</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Открыть модальное окно. Автоматически определяет режим.
     */
    open() {
        const isAuth = this.app.authService.isAuthenticated;
        if (isAuth) {
            this.setMode('profile');
            this.loadUserProfile();
        } else {
            this.setMode('login');
        }
        this.modal.open();
    }

    /**
     * Закрыть модальное окно
     */
    close() {
        this.modal.close();
    }

    /**
     * Установить режим: 'login' или 'profile'
     * @param {string} mode
     */
    setMode(mode) {
        const title = document.getElementById('profileTitle');
        const actionBtn = document.getElementById('profileActionBtn');
        const logoutBtn = document.getElementById('profileLogoutBtn');
        const cancelBtn = document.getElementById('profileCancelBtn');
        const errorEl = document.getElementById('authError');
        errorEl.style.display = 'none';

        if (mode === 'login') {
            title.textContent = '🔐 Вход / Регистрация';
            actionBtn.textContent = '💾 Войти / Зарегистрироваться';
            actionBtn.className = 'btn-primary';
            logoutBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
            // Очищаем поля
            document.getElementById('userNameInput').value = '';
            document.getElementById('userAvatarInput').value = '👤';
            document.getElementById('userColorInput').value = '#7ec8e3';
            this.updatePreview();
        } else { // profile
            title.textContent = '👤 Ваш профиль';
            actionBtn.textContent = '💾 Сохранить';
            actionBtn.className = 'btn-primary';
            logoutBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
        }
        this.currentMode = mode;
    }

    /**
     * Загрузить данные текущего пользователя в форму
     */
    loadUserProfile() {
        const user = this.app.multiUserManager.localUser;
        document.getElementById('userNameInput').value = user.Name || '';
        document.getElementById('userAvatarInput').value = user.Avatar || '👤';
        document.getElementById('userColorInput').value = user.Color || '#7ec8e3';
        this.updatePreview();
    }

    /**
     * Обновить превью профиля
     */
    updatePreview() {
        const name = document.getElementById('userNameInput').value || 'Пользователь';
        const avatar = document.getElementById('userAvatarInput').value || '👤';
        const color = document.getElementById('userColorInput').value || '#7ec8e3';
        document.getElementById('userPreviewAvatar').textContent = avatar;
        document.getElementById('userPreviewName').textContent = name;
        document.getElementById('userPreview').style.borderColor = color;
        const statusText = this.app.authService.isAuthenticated ? '🟢 Онлайн' : '⚪ Офлайн';
        document.getElementById('userPreviewStatus').textContent = statusText;
    }

    /**
     * Основное действие: вход или сохранение профиля
     */
    async handleAction() {
        const name = document.getElementById('userNameInput').value.trim();
        const avatar = document.getElementById('userAvatarInput').value.trim() || '👤';
        const color = document.getElementById('userColorInput').value;

        if (!name) {
            this.showError('Введите имя пользователя');
            return;
        }

        if (this.currentMode === 'login') {
            // Регистрация нового пользователя
            try {
                const userData = {
                    userId: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
                    name,
                    avatar,
                    color
                };
                const user = await this.app.authService.registerUser(userData);
                this.close();
                // Обновляем приложение
                this.app.multiUserManager.localUser = user;
                this.app.multiUserManager.saveUser(user);
                this.app.multiUserManager.renderUsers();
                this.app.multiUserManager.connectToServer();
                this.app.updateAuthUI();
                this.app.toast.success(`Добро пожаловать, ${user.name}!`);
            } catch (error) {
                this.showError(error.message || 'Ошибка регистрации');
            }
        } else {
            // Сохранение профиля
            const user = this.app.multiUserManager.localUser;
            user.name = name;
            user.avatar = avatar;
            user.color = color;
            user.Name = name;
            user.Avatar = avatar;
            user.Color = color;
            this.app.multiUserManager.saveUser(user);
            try {
                await this.app.multiUserManager.api.updateUserProfile({
                    userId: user.Id,
                    name,
                    avatar,
                    color,
                    Name: name,
                    Avatar: avatar,
                    Color: color
                });
                this.app.toast.success('✅ Профиль обновлен');
                this.close();
                this.app.multiUserManager.renderUsers();
                this.app.updateAuthUI();
            } catch (error) {
                this.showError('Ошибка сохранения профиля');
            }
        }
    }

    /**
     * Выход из аккаунта
     */
    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            await this.app.authService.logout();
            this.close();
            // Перезагружаем страницу для полной очистки состояния
            window.location.reload();
        }
    }

    showError(msg) {
        const el = document.getElementById('authError');
        el.textContent = msg;
        el.style.display = 'block';
    }

    hideError() {
        document.getElementById('authError').style.display = 'none';
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Открытие по кнопке профиля (уже есть в app)
        document.getElementById('userProfileBtn')?.addEventListener('click', () => this.open());

        // Закрытие
        document.getElementById('profileModalClose')?.addEventListener('click', () => this.close());
        document.getElementById('profileCancelBtn')?.addEventListener('click', () => this.close());

        // Сохранение / вход
        document.getElementById('profileActionBtn')?.addEventListener('click', () => this.handleAction());

        // Выход
        document.getElementById('profileLogoutBtn')?.addEventListener('click', () => this.logout());

        // Превью при вводе
        document.getElementById('userNameInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userAvatarInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userColorInput')?.addEventListener('input', () => this.updatePreview());

        // Предустановленные аватарки
        document.querySelectorAll('.avatar-preset').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('userAvatarInput').value = el.textContent;
                this.updatePreview();
            });
        });

        // Предустановленные цвета
        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('userColorInput').value = el.dataset.color;
                this.updatePreview();
                document.querySelectorAll('.color-preset-option').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
            });
        });

        // Закрытие по клику на overlay
        document.getElementById('profileModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('profileModal')) {
                this.close();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.isActive()) {
                this.close();
            }
        });
    }
}