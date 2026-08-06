// src/ui/views/game-view.js
import { Modal } from '../components/modal.js';
import { Game2048 } from '../../games/game-2048.js';
import { SnakeGame } from '../../games/snake-game.js';
import { TetrisGame } from '../../games/tetris-game.js';

/**
 * Модальное окно с играми
 */
export class GameView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('gameModal'));
        this.container = document.getElementById('gameContainer');
        this.currentGame = null;
        this.currentGameType = '2048';

        this.setupEventListeners();
    }

    open() {
        this.modal.open();
        this.switchGame('2048');
    }

    close() {
        if (this.currentGame?.loop) {
            clearInterval(this.currentGame.loop);
            this.currentGame.loop = null;
        }
        this.currentGame = null;
        this.modal.close();
    }

    switchGame(type) {
        this.currentGameType = type;
        
        // Обновляем активную опцию
        document.querySelectorAll('.game-option').forEach(o => {
            o.classList.toggle('active', o.dataset.game === type);
        });

        if (this.container) {
            this.container.innerHTML = '';
        }

        if (this.currentGame?.loop) {
            clearInterval(this.currentGame.loop);
            this.currentGame.loop = null;
        }

        if (type === '2048') {
            this.currentGame = new Game2048(this.container, 4);
            this.currentGame.render();
        } else if (type === 'snake') {
            this.container.innerHTML = `
                <div id="snakeInfo" style="margin-bottom:4px;font-size:12px;">Счёт: 0 | Ур. 1/10</div>
                <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px;">
                    <button onclick="window.gameView.currentGame?.start()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--success-color);color:#fff;cursor:pointer;">▶ Старт</button>
                    <button onclick="window.gameView.currentGame?.togglePause()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--warning-color);color:#fff;cursor:pointer;">⏯ Пауза</button>
                    <button onclick="window.gameView.currentGame?.newGame()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">🔄 Новая</button>
                </div>
            `;
            this.currentGame = new SnakeGame(this.container);
        } else if (type === 'tetris') {
            this.container.innerHTML = `
                <div id="tetrisInfo" style="margin-bottom:4px;font-size:12px;">Счёт: 0</div>
                <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px;">
                    <button onclick="window.gameView.currentGame?.start()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--success-color);color:#fff;cursor:pointer;">▶ Старт</button>
                    <button onclick="window.gameView.currentGame?.togglePause()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--warning-color);color:#fff;cursor:pointer;">⏯ Пауза</button>
                    <button onclick="window.gameView.currentGame?.newGame()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">🔄 Новая</button>
                </div>
                <div style="display:flex;gap:4px;justify-content:center;">
                    <button onclick="window.gameView.currentGame?.move(-1)" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">◀</button>
                    <button onclick="window.gameView.currentGame?.rotate()" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">🔄</button>
                    <button onclick="window.gameView.currentGame?.move(1)" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">▶</button>
                    <button onclick="window.gameView.currentGame?.hardDrop()" style="padding:6px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">⏬</button>
                </div>
            `;
            this.currentGame = new TetrisGame(this.container);
        }

        // Сохраняем ссылку на gameView для доступа из кнопок
        window.gameView = this;
    }

    setupEventListeners() {
        document.getElementById('gameBtn')?.addEventListener('click', () => this.open());
        document.getElementById('gameModalClose')?.addEventListener('click', () => this.close());

        // Выбор игры
        document.querySelectorAll('.game-option').forEach(option => {
            option.addEventListener('click', () => {
                this.switchGame(option.dataset.game);
            });
        });

        // Закрытие по клику на overlay
        document.getElementById('gameModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('gameModal')) {
                this.close();
            }
        });

        // Клавиатурное управление
        document.addEventListener('keydown', (e) => {
            if (!this.modal.isActive()) return;
            if (!this.currentGame) return;

            if (this.currentGame instanceof Game2048) {
                const moves = {
                    'ArrowLeft': 'left',
                    'ArrowRight': 'right',
                    'ArrowUp': 'up',
                    'ArrowDown': 'down',
                    'a': 'left',
                    'd': 'right',
                    'w': 'up',
                    's': 'down'
                };
                if (moves[e.key]) {
                    e.preventDefault();
                    this.currentGame.move(moves[e.key]);
                }
            } else if (this.currentGame instanceof SnakeGame && this.currentGame.started && !this.currentGame.paused) {
                const moves = {
                    'ArrowLeft': {x: -1, y: 0},
                    'ArrowRight': {x: 1, y: 0},
                    'ArrowUp': {x: 0, y: -1},
                    'ArrowDown': {x: 0, y: 1},
                    'a': {x: -1, y: 0},
                    'd': {x: 1, y: 0},
                    'w': {x: 0, y: -1},
                    's': {x: 0, y: 1}
                };
                if (moves[e.key]) {
                    e.preventDefault();
                    this.currentGame.setDir(moves[e.key].x, moves[e.key].y);
                }
            } else if (this.currentGame instanceof TetrisGame && this.currentGame.started && !this.currentGame.paused) {
                if (e.key === 'ArrowLeft' || e.key === 'a') {
                    e.preventDefault();
                    this.currentGame.move(-1);
                } else if (e.key === 'ArrowRight' || e.key === 'd') {
                    e.preventDefault();
                    this.currentGame.move(1);
                } else if (e.key === 'ArrowUp' || e.key === 'w') {
                    e.preventDefault();
                    this.currentGame.rotate();
                } else if (e.key === 'ArrowDown' || e.key === 's') {
                    e.preventDefault();
                    this.currentGame.drop();
                } else if (e.key === ' ') {
                    e.preventDefault();
                    this.currentGame.hardDrop();
                }
            }
        });
    }
}