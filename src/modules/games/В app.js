async showGames() {
    // ...
    if (!this.gamesLoaded) {
        try {
            const module = await import('./modules/games/GamesModule.js');
            this.gamesModule = new module.GamesModule(this);
            this.gamesModule.init();
            this.gamesLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки игрового модуля:', error);
            this.toast.error('Не удалось загрузить игры');
        }
    } else {
        this.gamesModule.init();
    }
}