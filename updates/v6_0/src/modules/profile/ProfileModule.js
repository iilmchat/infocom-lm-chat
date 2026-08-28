// src/modules/profile/ProfileModule.js
/**
 * Модуль профиля (страница)
 * Добавлено в 6.0
 * Отображает данные пользователя и позволяет редактировать профиль.
 */
import { sanitizeHTML } from '../../services/sanitizer.js';

export class ProfileModule {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.user = this.app.multiUserManager.localUser;
        this.isAuth = this.app.authService.isAuthenticated;
        this.render();
        this.setupEventListeners();
    }

    render() {
        // Заполняем контейнер HTML-разметкой профиля
        this.container.innerHTML = `
            <div style="max-width:600px; margin:0 auto; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>👤 Ваш профиль</h2>
                    <button id="profileBackBtn" class="btn-secondary" data-link="/">← Назад в чат</button>
                </div>

                <div class="user-preview" id="profilePreview" style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--bg-primary);border-radius:12px;border:2px solid var(--text-accent);margin-bottom:20px;">
                    <span id="profilePreviewAvatar" style="font-size:48px;">${this.user.Avatar || '👤'}</span>
                    <div>
                        <div id="profilePreviewName" style="font-size:18px;font-weight:600;">${sanitizeHTML(this.user.Name || 'Пользователь')}</div>
                        <div id="profilePreviewStatus" style="font-size:12px;color:var(--text-secondary);">${this.isAuth ? '🟢 Онлайн' : '⚪ Офлайн'}</div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="profileNameInput" placeholder="Введите имя..." maxlength="20" value="${sanitizeHTML(this.user.Name || '')}">
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
                    <input type="text" id="profileAvatarInput" placeholder="👤" maxlength="2" style="width:60px;" value="${this.user.Avatar || '👤'}">
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
                    <input type="color" id="profileColorInput" value="${this.user.Color || '#7ec8e3'}" style="width:60px;height:40px;border:none;border-radius:8px;cursor:pointer;">
                </div>

                <div id="profileError" style="color:var(--error-color);font-size:12px;margin-top:8px;display:none;"></div>

                <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px;flex-wrap:wrap;">
                    <button class="btn-primary" id="profileSaveBtn">💾 Сохранить</button>
                    <button class="btn-danger" id="profileLogoutBtn" style="${!this.isAuth ? 'display:none;' : ''}">🚪 Выйти</button>
                </div>
            </div>
        `;

        // Сохраняем ссылки на элементы
        this.nameInput = document.getElementById('profileNameInput');
        this.avatarInput = document.getElementById('profileAvatarInput');
        this.colorInput = document.getElementById('profileColorInput');
        this.previewAvatar = document.getElementById('profilePreviewAvatar');
        this.previewName = document.getElementById('profilePreviewName');
        this.previewStatus = document.getElementById('profilePreviewStatus');
        this.errorEl = document.getElementById('profileError');

        // Устанавливаем активный цвет
        const color = this.user.Color || '#7ec8e3';
        this.colorInput.value = color;
        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === color);
        });

        // Обновляем превью
        this.updatePreview();

        // Обработчики для предустановок
        document.querySelectorAll('.avatar-preset').forEach(el => {
            el.addEventListener('click', () => {
                this.avatarInput.value = el.textContent;
                this.updatePreview();
            });
        });

        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.color-preset-option').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                this.colorInput.value = el.dataset.color;
                this.updatePreview();
            });
        });

        // Кнопка "Назад"
        document.getElementById('profileBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });
    }

    setupEventListeners() {
        // Сохранение
        document.getElementById('profileSaveBtn')?.addEventListener('click', () => this.saveProfile());

        // Выход
        document.getElementById('profileLogoutBtn')?.addEventListener('click', () => this.logout());

        // Превью при вводе
        this.nameInput.addEventListener('input', () => this.updatePreview());
        this.avatarInput.addEventListener('input', () => this.updatePreview());
        this.colorInput.addEventListener('input', () => this.updatePreview());
    }

    updatePreview() {
        const name = this.nameInput.value.trim() || 'Пользователь';
        const avatar = this.avatarInput.value.trim() || '👤';
        const color = this.colorInput.value || '#7ec8e3';

        this.previewAvatar.textContent = avatar;
        this.previewName.textContent = sanitizeHTML(name);
        document.getElementById('profilePreview').style.borderColor = color;
        this.previewStatus.textContent = this.isAuth ? '🟢 Онлайн' : '⚪ Офлайн';
    }

    showError(msg) {
        this.errorEl.textContent = msg;
        this.errorEl.style.display = 'block';
    }

    hideError() {
        this.errorEl.style.display = 'none';
    }

    async saveProfile() {
        const name = this.nameInput.value.trim();
        const avatar = this.avatarInput.value.trim() || '👤';
        const color = this.colorInput.value;

        if (!name) {
            this.showError('Введите имя пользователя');
            return;
        }

        // Обновляем локального пользователя
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
                name: name,
                avatar: avatar,
                color: color,
                Name: name,
                Avatar: avatar,
                Color: color
            });
            this.app.toast.success('✅ Профиль обновлен');
            this.app.multiUserManager.renderUsers();
            this.updatePreview();
            this.hideError();
        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            this.showError('Ошибка сохранения профиля');
            this.app.toast.error('Не удалось сохранить профиль');
        }
    }

    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            await this.app.authService.logout();
            // Перезагружаем страницу для полной очистки состояния
            window.location.reload();
        }
    }
}