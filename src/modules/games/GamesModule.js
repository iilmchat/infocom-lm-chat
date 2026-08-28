// src/modules/games/GamesModule.js
/**
 * Модуль игр
 * Добавлено в 6.0
 * Отвечает за загрузку и управление игровым интерфейсом.
 */
import { GameView } from '../../ui/views/game-view.js';

export class GamesModule {
    constructor(app) {
        this.app = app;
        this.gameView = null;
    }

    init() {
        if (!this.gameView) {
            this.gameView = new GameView(this.app);
        }
        this.gameView.open();
        return this;
    }

    destroy() {
        if (this.gameView) {
            this.gameView.close();
        }
    }
}