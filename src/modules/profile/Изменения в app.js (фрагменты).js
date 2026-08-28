// Добавляем импорт модуля (динамический, поэтому не нужен вверху)

// В конструкторе:
this.profileModule = null;
this.profileLoaded = false;

// В showProfile:
async showProfile() {
    document.getElementById('app-chat').style.display = 'none';
    document.getElementById('app-admin').style.display = 'none';
    document.getElementById('app-games').style.display = 'none';
    document.getElementById('app-profile').style.display = 'block';
    document.getElementById('sidebar').style.display = 'none';
    this.updateActiveNav('profile');

    if (!this.profileLoaded) {
        try {
            const module = await import('./modules/profile/ProfileModule.js');
            const container = document.getElementById('app-profile');
            this.profileModule = new module.ProfileModule(this, container);
            this.profileLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            this.toast.error('Не удалось загрузить профиль');
        }
    } else {
        // Если уже загружен, можно перерисовать или просто показать
        // Для простоты оставляем как есть, или вызываем метод обновления
        this.profileModule.updatePreview?.();
    }
}