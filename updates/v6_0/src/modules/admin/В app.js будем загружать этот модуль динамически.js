// В app.js, метод showAdmin:
async showAdmin() {
    // ... скрыть другие контейнеры ...
    if (!this.adminLoaded) {
        try {
            const module = await import('./modules/admin/AdminModule.js');
            this.adminModule = new module.AdminModule(this);
            this.adminModule.init();
            this.adminLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки админ-модуля:', error);
            this.toast.error('Не удалось загрузить админ-панель');
        }
    } else {
        this.adminModule.init(); // повторное открытие
    }
}