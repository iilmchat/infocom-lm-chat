// src/ui/views/user-modal.js
import { Modal } from '../components/modal.js';

export class UserModal {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('userModal'));
        this.setupEventListeners();
    }

    open() {
        this.loadUserProfile();
        this.modal.open();
    }

    close() {
        this.modal.close();
    }

    loadUserProfile() {
        const user = this.app.multiUserManager.localUser;
        document.getElementById('userNameInput').value = user.name || '';
        document.getElementById('userAvatarInput').value = user.avatar || '👤';
        document.getElementById('userColorInput').value = user.color || '#7ec8e3';
        this.updatePreview();
    }

    updatePreview() {
        const name = document.getElementById('userNameInput').value || 'Пользователь';
        const avatar = document.getElementById('userAvatarInput').value || '👤';
        const color = document.getElementById('userColorInput').value || '#7ec8e3';
        
        document.getElementById('userPreviewAvatar').textContent = avatar;
        document.getElementById('userPreviewName').textContent = name;
        document.getElementById('userPreview').style.borderColor = color;
    }

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
        
        // Сохраняем в localStorage
        localStorage.setItem('user_profile', JSON.stringify(this.app.multiUserManager.localUser));

        // Отправляем на сервер
        try {
            await this.app.multiUserManager.api.updateUserProfile({
                userId: this.app.multiUserManager.localUser.id,
                name: name,
                avatar: avatar,
                color: color
            });
            this.app.toast.success('✅ Профиль обновлен');
            this.close();
            this.app.multiUserManager.renderUsers();
        } catch (error) {
            this.app.toast.error('❌ Ошибка сохранения профиля');
        }
    }

    setupEventListeners() {
        // Превью при вводе
        document.getElementById('userNameInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userAvatarInput')?.addEventListener('input', () => this.updatePreview());
        document.getElementById('userColorInput')?.addEventListener('input', () => this.updatePreview());

        // Сохранение
        document.getElementById('userSaveBtn')?.addEventListener('click', () => this.saveUserProfile());

        // Закрытие
        document.getElementById('userModalClose')?.addEventListener('click', () => this.close());

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
    }
}