// src/ui/views/user-modal.js
import { Modal } from '../components/modal.js';

/**
 * Модальное окно для управления профилем пользователя
 * Добавлено в 5.1: выход из аккаунта
 */
export class UserModal {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('userModal'));
        this.setupEventListeners();
    }

    /**
     * Открыть модальное окно профиля
     */
    open() {
        this.loadUserProfile();
        this.modal.open();
    }

    /**
     * Закрыть модальное окно профиля
     */
    close() {
        this.modal.close();
    }

    /**
     * Загрузить данные пользователя в форму
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
    }

    /**
     * Сохранить изменения профиля
     */
    async saveUserProfile() {
        const name = document.getElementById('userNameInput').value.trim();
        const avatar = document.getElementById('userAvatarInput').value.trim();
        const color = document.getElementById('userColorInput').value;

        if (!name) {
            this.app.toast.warning('Введите имя пользователя');
            return;
        }

        // Обновляем локального пользователя
        this.app.multiUserManager.localUser.name = name;
        this.app.multiUserManager.localUser.avatar = avatar;
        this.app.multiUserManager.localUser.color = color;

        this.app.multiUserManager.localUser.Name = name;
        this.app.multiUserManager.localUser.Avatar = avatar;
        this.app.multiUserManager.localUser.Color = color;        
        // Сохраняем в localStorage
        localStorage.setItem('user_profile', JSON.stringify(this.app.multiUserManager.localUser));

        // Отправляем на сервер
        try {
            await this.app.multiUserManager.api.updateUserProfile({
                userId: this.app.multiUserManager.localUser.Id,
                name: name,
                avatar: avatar,
                color: color,
                Name: name,
                Avatar: avatar,
                Color: color                
            });
            this.app.toast.success('✅ Профиль обновлен');
            this.close();
            this.app.multiUserManager.renderUsers();
        } catch (error) {
            this.app.toast.error('❌ Ошибка сохранения профиля');
        }
    }

    /**
     * Выход из аккаунта
     * Добавлено в 5.1.
     */
    async logout() {
        if (confirm('Выйти из аккаунта?')) {
            await this.app.authService.logout();
            this.close();
            // Перезагружаем страницу для очистки состояния
            window.location.reload();
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Открытие
        //document.getElementById('userModal')?.addEventListener('click', () => this.open());
        // Открытие (вызывается из app.js)
        // document.getElementById('userProfileBtn')?.addEventListener('click', () => this.open());
         
        // Превью при вводе
        document.getElementById('userNameInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userAvatarInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userColorInput')?.addEventListener('input', () => this.updatePreview());

        // Сохранение
        document.getElementById('userSaveBtn')?.addEventListener('click', () => this.saveUserProfile());

        // Закрытие
        document.getElementById('userModalClose')?.addEventListener('click', () => this.close());

        // Добавлено в 5.1: кнопка выхода (если есть в модалке)
        const logoutBtn = document.getElementById('userLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

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
        document.getElementById('userModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('userModal')) {
                this.close();
            }
        });   
    }
}