// src/modules/profile/ProfileModule.js
/**
 * Модуль профиля (страница)
 * Добавлено в 6.0
 * 
 * Изменено в 6.1:
 * - Полноценная страница профиля (без модалки как fallback)
 * - Добавлена статистика пользователя (сообщения, достижения, RAG, файлы)
 * - Реализован экспорт данных пользователя в JSON
 * - Реализован импорт данных из JSON с валидацией
 * - Поддержка AvatarService (выбор типа аватара, загрузка изображения)
 */

import { CONFIG, SERVER_CONFIG, saveServerConfig } from '../../config.js';
import { sanitizeHTML } from '../../services/sanitizer.js';
import { applyTheme } from '../../ui/theme.js';

export class ProfileModule {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.user = this.app.multiUserManager.localUser;
        this.isAuth = this.app.authService.isAuthenticated;
        this.avatarFileData = null;
        this.render();
        this.setupEventListeners();
        this.loadUserStats();
    }

    /* ===================== РЕНДЕРИНГ ===================== */

    render() {
        // Заполняем контейнер HTML-разметкой профиля
        this.container.innerHTML = `
            <div style="max-width:700px; margin:0 auto; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                    <h2>👤 Ваш профиль</h2>
                    <button id="profileBackBtn" class="btn btn-secondary" data-link="/">← Назад в чат</button>
                </div>

                <!-- Превью профиля -->
                <div class="user-preview" id="profilePreview" style="display:flex; align-items:center; gap:16px; padding:16px; background:var(--bg-secondary); border-radius:12px; border:2px solid var(--text-accent); margin-bottom:20px;">
                    <div id="profilePreviewAvatar" style="font-size:48px;">${this.user.Avatar || '👤'}</div>
                    <div>
                        <div id="profilePreviewName" style="font-size:18px; font-weight:600;">${sanitizeHTML(this.user.Name || 'Пользователь')}</div>
                        <div id="profilePreviewStatus" style="font-size:12px; color:var(--text-secondary);">${this.isAuth ? '🟢 Онлайн' : '⚪ Офлайн'}</div>
                    </div>
                </div>

                <!-- Форма редактирования -->
                <div class="profile-form">
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="profileNameInput" placeholder="Введите имя..." maxlength="20" value="${sanitizeHTML(this.user.Name || '')}">
                </div>

                    <!-- Выбор типа аватара -->
                <div class="form-group">
                    <label>Тип аватара</label>
                    <select id="profileAvatarTypeSelect" class="form-control">
                        <option value="emoji" ${this.user.avatarType === 'emoji' ? 'selected' : ''}>Эмодзи</option>
                        <option value="initials" ${this.user.avatarType === 'initials' ? 'selected' : ''}>Инициалы</option>
                        <option value="image" ${this.user.avatarType === 'image' ? 'selected' : ''}>Изображение</option>
                    </select>
                </div>

                <div id="profileEmojiContainer" class="avatar-option">
                        <div class="avatar-presets" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">😊</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">😎</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🤖</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🦊</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐱</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐶</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐼</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🦁</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐯</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐸</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐵</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🦄</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐲</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐳</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐧</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐨</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🦋</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">🐙</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">👩‍💻</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">👨‍💻</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">👩‍🔬</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">👨‍🎨</span>
                            <span class="avatar-preset" style="font-size:28px; cursor:pointer; padding:4px 8px; border-radius:8px; border:2px solid transparent; transition:all 0.2s;">👩‍🏫</span>
                    </div>
                    <input type="text" id="profileAvatarInput" placeholder="👤" maxlength="2" style="width:60px;" value="${this.user.avatarType === 'emoji' ? (this.user.avatarData || '👤') : ''}">
                </div>

                <div id="profileInitialsContainer" class="avatar-option" style="display:${this.user.avatarType === 'initials' ? 'block' : 'none'};">
                    <label>Цвет фона</label>
                        <input type="color" id="profileInitialsColor" value="${this.user.color || '#7ec8e3'}" style="width:60px; height:40px; border:none; border-radius:8px; cursor:pointer;">
                </div>

                <div id="profileImageContainer" class="avatar-option" style="display:${this.user.avatarType === 'image' ? 'block' : 'none'};">
                    <label>Загрузить изображение</label>
                    <input type="file" id="profileAvatarFile" accept="image/*">
                    <div id="profileAvatarPreview" style="margin-top:8px;">${this.user.avatarType === 'image' && this.user.avatarData ? `<img src="${this.user.avatarData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">` : ''}</div>
                </div>

                    <div id="profileError" style="color:var(--error-color); font-size:12px; margin-top:8px; display:none;"></div>
                </div>

                <!-- Статистика пользователя (добавлено в 6.1) -->
                <div class="profile-stats" style="margin-top:24px; border-top:1px solid var(--border-color); padding-top:16px;">
                    <h3>📊 Моя статистика</h3>
                    <div id="userStatsContainer" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr)); gap:12px; margin-top:12px;">
                        <div class="stat-card" style="background:var(--bg-secondary); border-radius:8px; padding:12px; text-align:center; border:1px solid var(--border-color);">
                            <div style="font-size:24px; font-weight:700; color:var(--text-accent);" id="userMsgCount">0</div>
                            <div style="font-size:12px; color:var(--text-secondary);">Сообщений</div>
                        </div>
                        <div class="stat-card" style="background:var(--bg-secondary); border-radius:8px; padding:12px; text-align:center; border:1px solid var(--border-color);">
                            <div style="font-size:24px; font-weight:700; color:var(--text-accent);" id="userAchCount">0</div>
                            <div style="font-size:12px; color:var(--text-secondary);">Достижений</div>
                        </div>
                        <div class="stat-card" style="background:var(--bg-secondary); border-radius:8px; padding:12px; text-align:center; border:1px solid var(--border-color);">
                            <div style="font-size:24px; font-weight:700; color:var(--text-accent);" id="userRagCount">0</div>
                            <div style="font-size:12px; color:var(--text-secondary);">RAG чанков</div>
                        </div>
                        <div class="stat-card" style="background:var(--bg-secondary); border-radius:8px; padding:12px; text-align:center; border:1px solid var(--border-color);">
                            <div style="font-size:24px; font-weight:700; color:var(--text-accent);" id="userFileCount">0</div>
                            <div style="font-size:12px; color:var(--text-secondary);">Файлов</div>
                        </div>
                    </div>
                </div>

                <!-- Действия: экспорт/импорт (добавлено в 6.1) -->
                <div class="profile-actions" style="display:flex; gap:12px; margin-top:20px; flex-wrap:wrap;">
                    <button id="exportDataBtn" class="btn btn-primary">💾 Экспорт данных</button>
                    <button id="importDataBtn" class="btn btn-secondary">📂 Импорт данных</button>
                    <button id="profileLogoutBtn" class="btn btn-danger" style="${!this.isAuth ? 'display:none;' : ''}">🚪 Выйти</button>
                    <button id="profileSaveBtn" class="btn btn-success" style="margin-left:auto;">💾 Сохранить профиль</button>
                </div>
                <input type="file" id="importFileInput" accept=".json" style="display:none;">
            </div>
        `;

        // Сохраняем ссылки на элементы
        this.nameInput = document.getElementById('profileNameInput');
        this.avatarInput = document.getElementById('profileAvatarInput');
        this.avatarTypeSelect = document.getElementById('profileAvatarTypeSelect');
        this.initialsColor = document.getElementById('profileInitialsColor');
        this.avatarFile = document.getElementById('profileAvatarFile');
        this.avatarPreview = document.getElementById('profileAvatarPreview');
        this.previewAvatar = document.getElementById('profilePreviewAvatar');
        this.previewName = document.getElementById('profilePreviewName');
        this.previewStatus = document.getElementById('profilePreviewStatus');
        this.errorEl = document.getElementById('profileError');
        this.initialsColorInput = document.getElementById('initialsColorInput');

        // Устанавливаем активный цвет
        const color = this.user.Color || '#7ec8e3';
        this.initialsColorInput.value = color;
        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.classList.toggle('selected', el.dataset.color === color);
        });

        // Обновляем превью
        this.updatePreview();
        this.updateAvatarOptions(this.avatarTypeSelect.value);

        // Обработчики для предустановок аватара и цвета (аналогично profile-modal)
        document.querySelectorAll('.avatar-preset').forEach(el => {
            el.addEventListener('click', () => {
                this.avatarInput.value = el.textContent;
                this.avatarTypeSelect.value = 'emoji';
                this.updateAvatarOptions('emoji');
                this.updatePreview();
            });
        });

        //6.1 Перенесено выше
        /*
        document.querySelectorAll('.color-preset-option').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.color-preset-option').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                this.colorInput.value = el.dataset.color;
                this.updatePreview();
            });
        });
        */

        // Кнопка "Назад" 
        //6.1 Перенесена
        /*
        document.getElementById('profileBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });
        */

        // Для цвета здесь можно добавить палитру, но пока просто через color input
        this.initialsColor?.addEventListener('input', () => this.updatePreview());        
    }

    /* ===================== ОБНОВЛЕНИЕ ПРЕВЬЮ ===================== */

    updatePreview() {
        const name = this.nameInput.value.trim() || 'Пользователь';
        const type = this.avatarTypeSelect.value;
        let userData = {
            name: name,
            avatarType: type,
            color: this.initialsColor?.value || '#7ec8e3'
        };

        if (type === 'emoji') {
            userData.avatarData = this.avatarInput.value || '👤';
        } else if (type === 'initials') {
            userData.color = this.initialsColor?.value || '#7ec8e3';
        } else if (type === 'image') {
            userData.avatarData = this.avatarFileData || null;
        }

        const avatarHTML = this.app.avatarService ? this.app.avatarService.getAvatarHTML(userData) : '👤';
        this.previewAvatar.innerHTML = avatarHTML;
        this.previewName.textContent = name;
        this.previewStatus.textContent = this.isAuth ? '🟢 Онлайн' : '⚪ Офлайн';
        // Обновляем рамку
        document.getElementById('profilePreview').style.borderColor = userData.color || '#7ec8e3';
    }
    
        updateAvatarOptions(type) {
        document.getElementById('profileEmojiContainer').style.display = type === 'emoji' ? 'block' : 'none';
        document.getElementById('profileInitialsContainer').style.display = type === 'initials' ? 'block' : 'none';
        document.getElementById('profileImageContainer').style.display = type === 'image' ? 'block' : 'none';
    }

    showError(msg) {
        this.errorEl.textContent = msg;
        this.errorEl.style.display = 'block';
    }

    hideError() {
        this.errorEl.style.display = 'none';
    }

    /* ===================== ЗАГРУЗКА СТАТИСТИКИ (добавлено в 6.1) ===================== */

    async loadUserStats() {
        try {
            const userId = this.app.multiUserManager.localUser.Id;
            const result = await this.app.apiService.getUserStats(userId);
            if (result.success) {
                const stats = result.stats || {};
                document.getElementById('userMsgCount').textContent = stats.messageCount || 0;
                document.getElementById('userAchCount').textContent = this.app.achievementManager.unlockedCount || 0;
                document.getElementById('userRagCount').textContent = this.app.ragManager.chunkCount || 0;
                document.getElementById('userFileCount').textContent = this.app.attachedFiles?.length || 0;
            }
        } catch (error) {
            console.warn('Не удалось загрузить статистику пользователя:', error);
        }
    }

    /* ===================== СОХРАНЕНИЕ ПРОФИЛЯ ===================== */

    async saveProfile() {
        const name = this.nameInput.value.trim();
        const type = this.avatarTypeSelect.value;
        let avatarData;
        let color;

        if (type === 'emoji') {
            avatarData = this.avatarInput.value.trim() || '👤';
        } else if (type === 'initials') {
            color = this.initialsColor?.value || '#7ec8e3';
            avatarData = this.app.avatarService?.generateInitialsImage(name, color);
        } else if (type === 'image') {
            if (this.avatarFileData) {
                avatarData = this.avatarFileData;
            } else {
                this.showError('Загрузите изображение');
                return;
            }
            color = this.user.color || '#7ec8e3';
        }

        if (!name) {
            this.showError('Введите имя пользователя');
            return;
        }

        // Обновляем локального пользователя
        const user = this.app.multiUserManager.localUser;
        if (this.app.avatarService) {
            this.app.avatarService.applyAvatar(user, type, avatarData, color);
        }
        
        user.name = name;
        //6.1 Скрыто?
        /*
        user.avatar = avatar;
        */
        user.color = color;
        user.avatarType = type;
        user.avatarData = avatarData;

        user.Name = name;
        //6.1 Скрыто?
        /*
        user.Avatar = avatar;
        */
        user.Color = color;
        user.AvatarType = type;
        user.AvatarData = avatarData;

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
            this.app.multiUserManager.renderUsers();
            this.updatePreview();
            this.hideError();
            // Обновляем статистику
            this.loadUserStats();
        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            this.showError('Ошибка сохранения профиля');
            this.app.toast.error('Не удалось сохранить профиль');
        }
    }

    /* ===================== ЭКСПОРТ ДАННЫХ (добавлено в 6.1) ===================== */

    exportUserData() {
        const data = {
            version: CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            user: this.app.multiUserManager.localUser,
            sessions: this.app.sessionManager.sessions,
            currentSessionId: this.app.sessionManager.currentId,
            ragData: this.app.ragManager.toJSON(),
            achievements: this.app.achievementManager.achievements,
            settings: {
                server: {
                    ip: SERVER_CONFIG.ip,
                    port: SERVER_CONFIG.port,
                    ip_lm: SERVER_CONFIG.ip_lm,
                    port_lm: SERVER_CONFIG.port_lm,
                    timeout: SERVER_CONFIG.timeout,
                    maxTokens: SERVER_CONFIG.maxTokens,
                    apiPath: SERVER_CONFIG.apiPath
                },
                theme: this.app.currentTheme,
                admin: localStorage.getItem('admin_settings')
            },
            workspaces: this.app.multiUserManager.workspaceManager.workspaces
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_data_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.app.toast.success('✅ Данные экспортированы');
    }

    /* ===================== ИМПОРТ ДАННЫХ (добавлено в 6.1) ===================== */

    importUserData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Валидация
                if (!data.version || !data.user || !data.sessions) {
                    throw new Error('Некорректный формат файла: отсутствуют обязательные поля');
                }
                if (!confirm('Импорт перезапишет все текущие данные. Продолжить?')) return;

                // Восстановление
                // 1. Пользователь
                this.app.multiUserManager.localUser = data.user;
                this.app.multiUserManager.saveUser(data.user);

                // 2. Сессии
                this.app.sessionManager.sessions = data.sessions;
                this.app.sessionManager.currentId = data.currentSessionId;
                this.app.sessionManager.save();

                // 3. RAG
                if (data.ragData) {
                    this.app.ragManager.fromJSON(data.ragData);
                    this.app.sessionManager.setRAG(data.ragData);
                }

                // 4. Достижения
                if (data.achievements) {
                    Object.assign(this.app.achievementManager.achievements, data.achievements);
                    this.app.achievementManager.save();
                }

                // 5. Настройки
                if (data.settings) {
                    if (data.settings.server) {
                        Object.assign(SERVER_CONFIG, data.settings.server);
                        saveServerConfig();
                    }
                    if (data.settings.theme) {
                        applyTheme(data.settings.theme);
                        this.app.currentTheme = data.settings.theme;
                    }
                    if (data.settings.admin) {
                        localStorage.setItem('admin_settings', data.settings.admin);
                    }
                }

                // 6. Рабочие пространства
                if (data.workspaces) {
                    this.app.multiUserManager.workspaceManager.workspaces = data.workspaces;
                    this.app.multiUserManager.workspaceManager.saveToStorage();
                    // Обновляем текущее пространство
                    if (data.workspaces.some(w => w.id === this.app.multiUserManager.workspaceManager.currentWorkspaceId)) {
                        // сохраняем
                    } else {
                        this.app.multiUserManager.workspaceManager.currentWorkspaceId = data.workspaces[0]?.id || null;
                    }
                }

                this.app.toast.success('✅ Данные импортированы успешно');
                // Перезагружаем страницу для полного обновления
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                this.app.toast.error('❌ Ошибка импорта: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    /* ===================== ВЫХОД ===================== */

    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            await this.app.authService.logout();
            // Перезагружаем страницу для полной очистки состояния
            window.location.reload();
        }
    }

    /* ===================== НАСТРОЙКА ОБРАБОТЧИКОВ ===================== */

    setupEventListeners() {
        // Назад
        document.getElementById('profileBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });

        // Сохранить профиль
        document.getElementById('profileSaveBtn')?.addEventListener('click', () => {
            this.saveProfile();
        });

        // Выход
        document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
            this.logout();
        });

        // Экспорт
        document.getElementById('exportDataBtn')?.addEventListener('click', () => {
            this.exportUserData();
        });

        // Импорт
        document.getElementById('importDataBtn')?.addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput')?.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.importUserData(e.target.files[0]);
            }
            e.target.value = '';
        });

        // Превью при вводе
        this.nameInput.addEventListener('input', () => this.updatePreview());
        this.avatarInput.addEventListener('input', () => this.updatePreview());
        this.avatarTypeSelect.addEventListener('change', (e) => {
            this.updateAvatarOptions(e.target.value);
            this.updatePreview();
        });
        this.initialsColor?.addEventListener('input', () => this.updatePreview());

        // Загрузка изображения
        this.avatarFile?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                if (this.app.avatarService) {
                    const dataURL = await this.app.avatarService.compressImage(file);
                    this.avatarFileData = dataURL;
                    this.avatarPreview.innerHTML = `<img src="${dataURL}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;">`;
                    this.avatarTypeSelect.value = 'image';
                    this.updateAvatarOptions('image');
                    this.updatePreview();
                } else {
                    this.app.toast.error('AvatarService не доступен');
                }
            } catch (err) {
                this.app.toast.error('Не удалось загрузить изображение');
            }
        });

        // Предустановки аватара (уже добавлены в render)
        // Предустановки цвета можно добавить отдельно, но пока оставляем как есть
    }    
}