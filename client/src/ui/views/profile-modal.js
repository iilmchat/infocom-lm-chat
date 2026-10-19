// src/ui/views/profile-modal.js
/* Добавлено в 5.3 */
/* Изменено в 6.1: добавлена поддержка AvatarService, выбор типа аватара, загрузка изображения */

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
        this.avatarFileData = null; // временное хранилище DataURL для загрузки
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
                    <div id="userPreviewAvatar" style="font-size:48px;">👤</div>
                    <div>
                        <div id="userPreviewName" style="font-size:18px;font-weight:600;">Пользователь</div>
                        <div id="userPreviewStatus" style="font-size:12px;color:var(--text-secondary);">Статус: онлайн</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="userNameInput" placeholder="Введите имя..." maxlength="20">
                </div>

                <!-- Добавлено в 6.1: выбор типа аватара -->
                <div class="form-group">
                    <label>Тип аватара</label>
                    <select id="avatarTypeSelect" class="form-control">
                        <option value="emoji">Эмодзи</option>
                        <option value="initials">Инициалы</option>
                        <option value="image">Изображение</option>
                    </select>
                </div>

                <!-- Контейнер для эмодзи -->
                <div id="emojiContainer" class="avatar-option">
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

                <!-- Контейнер для инициалов (цвет) -->
                <div id="initialsContainer" class="avatar-option" style="display:none;">
                    <label>Цвет фона</label>
                    <input type="color" id="initialsColorInput" value="#7ec8e3" style="width:60px;height:40px;border:none;border-radius:8px;cursor:pointer;">
                </div>

                <!-- Контейнер для загрузки изображения -->
                <div id="imageContainer" class="avatar-option" style="display:none;">
                    <label>Загрузить изображение</label>
                    <input type="file" id="avatarFileInput" accept="image/*">
                    <div id="avatarPreview" style="margin-top:8px;"></div>
                </div>

                <div id="authError" style="color:var(--error-color);font-size:12px;margin-top:8px;display:none;"></div>
                
                <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;">
                    <!-- Изменено в 6.1: кнопки с классами btn -->
                    <button class="btn btn-secondary" id="profileCancelBtn">Отмена</button>
                    <button class="btn btn-primary" id="profileActionBtn">💾 Войти / Сохранить</button>
                    <button class="btn btn-danger" id="profileLogoutBtn" style="display:none;">🚪 Выйти</button>
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
    /* Изменено в 6.2: исправлен краш при setMode('login') — #userColorInput не существует (KI-031) */
    setMode(mode) {
        const title = document.getElementById('profileTitle');
        const actionBtn = document.getElementById('profileActionBtn');
        const logoutBtn = document.getElementById('profileLogoutBtn');
        const cancelBtn = document.getElementById('profileCancelBtn');
        const errorEl = document.getElementById('authError');
        if (errorEl) errorEl.style.display = 'none';

        /* Безопасные ссылки на поля (могут отсутствовать при первой инициализации) */
        const nameInput = document.getElementById('userNameInput');
        const avatarInput = document.getElementById('userAvatarInput');
        const initialsColorInput = document.getElementById('initialsColorInput');

        if (mode === 'login') {
            if (title) title.textContent = '🔐 Вход / Регистрация';
            if (actionBtn) {
                actionBtn.textContent = '💾 Войти / Зарегистрироваться';
                actionBtn.className = 'btn btn-primary';
            }
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';

            /* Очищаем поля (с guards — KI-031) */
            if (nameInput) nameInput.value = '';
            if (avatarInput) avatarInput.value = '👤';
            if (initialsColorInput) initialsColorInput.value = '#7ec8e3';

            this.updatePreview();
        } else {
            if (title) title.textContent = '👤 Ваш профиль';
            if (actionBtn) {
                actionBtn.textContent = '💾 Сохранить';
                actionBtn.className = 'btn btn-primary';
            }
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
        }
        this.currentMode = mode;
    }
    
    /**
     * Загрузить данные текущего пользователя в форму
     */
    loadUserProfile() {
        const user = this.app.multiUserManager.localUser;
        document.getElementById('userNameInput').value = user.Name || '';
        // Загружаем выбранный тип и данные
        const avatarType = user.avatarType || 'emoji';
        document.getElementById('avatarTypeSelect').value = avatarType;
        if (avatarType === 'emoji') {
            document.getElementById('userAvatarInput').value = user.avatarData || user.Avatar || '👤';
        } else if (avatarType === 'initials') {
            document.getElementById('initialsColorInput').value = user.color || '#7ec8e3';
        } else if (avatarType === 'image') {
            if (user.avatarData) {
                document.getElementById('avatarPreview').innerHTML = `<img src="${user.avatarData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`;
                this.avatarFileData = user.avatarData;
            }
        }
        this.updatePreview();
        this.updateAvatarOptions(avatarType);
    }

    /**
     * Обновить превью профиля
     */
    updatePreview() {
        const name = document.getElementById('userNameInput').value || 'Пользователь';
        const type = document.getElementById('avatarTypeSelect').value;
        let userData = {
            name: name,
            avatarType: type,
            color: document.getElementById('userColorInput')?.value || '#7ec8e3'
        };

        if (type === 'emoji') {
            userData.avatarData = document.getElementById('userAvatarInput').value || '👤';
        } else if (type === 'initials') {
            userData.color = document.getElementById('initialsColorInput')?.value || '#7ec8e3';
        } else if (type === 'image') {
            userData.avatarData = this.avatarFileData || null;
        }

        const avatarHTML = this.app.avatarService.getAvatarHTML(userData);
        document.getElementById('userPreviewAvatar').innerHTML = avatarHTML;
        document.getElementById('userPreviewName').textContent = name;
        //Удалено 6.1        
        //document.getElementById('userPreview').style.borderColor = color;
        const statusText = this.app.authService.isAuthenticated ? '🟢 Онлайн' : '⚪ Офлайн';
        document.getElementById('userPreviewStatus').textContent = statusText;
    }

    updateAvatarOptions(type) {
        document.getElementById('emojiContainer').style.display = type === 'emoji' ? 'block' : 'none';
        document.getElementById('initialsContainer').style.display = type === 'initials' ? 'block' : 'none';
        document.getElementById('imageContainer').style.display = type === 'image' ? 'block' : 'none';
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
     * Основное действие: вход или сохранение профиля
     */
    async handleAction() {
        const name = document.getElementById('userNameInput').value.trim();
        //Удалено 6.1
        //const avatar = document.getElementById('userAvatarInput').value.trim() || '👤';
        //Удалено 6.1        
        //const color = document.getElementById('userColorInput').value;

        if (!name) {
            this.showError('Введите имя пользователя');
            return;
        }

        const type = document.getElementById('avatarTypeSelect').value;
        let avatarData;
        let color;

        if (type === 'emoji') {
            avatarData = document.getElementById('userAvatarInput').value.trim() || '👤';
        } else if (type === 'initials') {
            color = document.getElementById('initialsColorInput').value || '#7ec8e3';
            // Генерируем DataURL и сохраняем как avatarData (можно использовать для отображения)
            avatarData = this.app.avatarService.generateInitialsImage(name, color);
        } else if (type === 'image') {
            if (this.avatarFileData) {
                avatarData = this.avatarFileData;
            } else {
                this.showError('Загрузите изображение');
                return;
            }
            color = document.getElementById('userColorInput')?.value || '#7ec8e3';
        }

        if (this.currentMode === 'login') {
            // Регистрация нового пользователя
            try {
                const userData = {
                    userId: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
                    name,
                    avatar: type === 'emoji' ? avatarData : '👤',
                    color: color || '#7ec8e3',
                    avatarType: type,
                    avatarData: avatarData
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
            this.app.avatarService.applyAvatar(user, type, avatarData, color);
            user.name = name;
            //user.avatar = avatar;
            //user.color = color;
            user.Name = name;
            //user.Avatar = avatar;
            //user.Color = color;
            this.app.multiUserManager.saveUser(user);
            try {
                await this.app.multiUserManager.api.updateUserProfile({
                    userId: user.Id,
                    name: name,
                    avatar: user.avatar,
                    color: user.color,
                    avatarType: type,
                    avatarData: avatarData,
                    Name: name,
                    Avatar: user.avatar,
                    Color: user.color,
                    AvatarType: type,
                    AvatarData: avatarData       
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

    /* 6.1 перенесено выше
    showError(msg) {
        const el = document.getElementById('authError');
        el.textContent = msg;
        el.style.display = 'block';
    }

    hideError() {
        document.getElementById('authError').style.display = 'none';
    }
    */
   
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
        document.getElementById('initialsColorInput')?.addEventListener('input', () => this.updatePreview());

        // Предустановленные аватарки
        document.querySelectorAll('.avatar-preset').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('userAvatarInput').value = el.textContent;
                document.getElementById('avatarTypeSelect').value = 'emoji';
                this.updateAvatarOptions('emoji');
                this.updatePreview();
            });
        });

        // Предустановленные цвета (для эмодзи и инициалов)
        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('userColorInput').value = el.dataset.color;
                document.getElementById('initialsColorInput').value = el.dataset.color;
                this.updatePreview();
                document.querySelectorAll('.color-preset-option').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
            });
        });

        // Переключение типа аватара
        document.getElementById('avatarTypeSelect')?.addEventListener('change', (e) => {
            const type = e.target.value;
            this.updateAvatarOptions(type);
            this.updatePreview();
        });

        // Загрузка изображения
        document.getElementById('avatarFileInput')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const dataURL = await this.app.avatarService.compressImage(file);
                this.avatarFileData = dataURL;
                document.getElementById('avatarPreview').innerHTML = `<img src="${dataURL}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`;
                document.getElementById('avatarTypeSelect').value = 'image';
                this.updateAvatarOptions('image');
                this.updatePreview();
            } catch (err) {
                this.app.toast.error('Не удалось загрузить изображение');
            }
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