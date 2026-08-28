// src/ui/views/game-view.js
import { Modal } from '../components/modal.js';
import { Game2048 } from '../../games/game-2048.js';
import { SnakeGame } from '../../games/snake-game.js';
import { TetrisGame } from '../../games/tetris-game.js';
import { BlockBlastGame } from '../../games/block-blast.js';

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

        // Добавлено в 5.1: поддержка Block Blast
        this.gameTypes = ['2048', 'snake', 'tetris', 'blockblast'];
        this.gameLabels = {
            '2048': '🔢 2048',
            'snake': '🐍 Змейка',
            'tetris': '🧱 Тетрис',
            'blockblast': '🧩 Block Blast' // Добавлено в 5.1
        };

        this.setupEventListeners();
        // Подписка на событие fullscreenchange в 5.4
        document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this)); //  в 5.4
        document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this)); // для Safari  в 5.4       
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

    // Подписка на событие fullscreenchange в 5.4
    handleFullscreenChange() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Выход из полноэкранного режима
            document.getElementById('sidebar')?.classList.remove('fullscreen-mode');
            document.querySelector('.chat-header')?.classList.remove('fullscreen-mode');
            if (this.container) {
                this.container.style.transform = 'scale(1)';
                this.container.style.transformOrigin = '';
            }
            this.app?.toast.info('Выход из полноэкранного режима', 1500);
        }
    }

    /* 5.4
    // В switchGame, внутри создания кнопок управления:
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.className = 'blast-btn';
    fullscreenBtn.title = 'На весь экран';
    fullscreenBtn.onclick = () => this.toggleFullscreen();
    // Добавить в контейнер с кнопками управления
    */
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

        // Добавлено в 5.1: блок для Block Blast
        if (type === 'blockblast') {
            // Создаём контейнер для игры
            const gameContainer = document.createElement('div');
            gameContainer.id = 'blockBlastContainer';
            this.container.appendChild(gameContainer);
            this.currentGame = new BlockBlastGame(gameContainer);
            // Автоматически стартуем
            this.currentGame.start();
            /*
                this.container.innerHTML = `
                    <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px;flex-wrap:wrap;">
                        <button onclick="window.gameView.currentGame?.start()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--success-color);color:#fff;cursor:pointer;">▶ Старт</button>
                        <button onclick="window.gameView.currentGame?.togglePause()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--warning-color);color:#fff;cursor:pointer;">⏯ Пауза</button>
                        <button onclick="window.gameView.currentGame?.newGame()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">🔄 Новая</button>
                    </div>
                    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                        <button onclick="window.gameView.currentGame?.moveLeft()" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">◀</button>
                        <button onclick="window.gameView.currentGame?.rotate()" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">🔄</button>
                        <button onclick="window.gameView.currentGame?.moveRight()" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;">▶</button>
                        <button onclick="window.gameView.currentGame?.moveDown()" style="padding:6px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">⬇</button>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Кликните по клетке для размещения фигуры</div>
                `;
                this.currentGame = new BlockBlast(this.container);
            */
        } else if (type === '2048') {
            this.currentGame = new Game2048(this.container, 4);
            this.currentGame.render();
        } else if (type === 'snake') {
            this.container.innerHTML = `
                <div id="snakeInfo" style="margin-bottom:4px;font-size:12px;">Счёт: 0 | Ур. 1/10</div>
                <div style="display:flex;gap:4px;justify-content:center;margin-bottom:4px;">
                    <button onclick="window.gameView.currentGame?.start()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--success-color);color:#fff;cursor:pointer;">▶ Старт</button>
                    <button onclick="window.gameView.currentGame?.togglePause()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--warning-color);color:#fff;cursor:pointer;">⏯ Пауза</button>
                    <button onclick="window.gameView.currentGame?.newGame()" style="padding:4px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;">🔄 Новая</button>
                    <button onclick="window.gameView.toggleFullscreen()" class="blast-btn">⛶ На весь экран</button>                    
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
                    <button onclick="window.gameView.toggleFullscreen()" class="blast-btn">⛶ На весь экран</button>                           
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

    // Добавлено в 5.4: полноэкранный режим
    toggleFullscreen() {
        const gameContainer = this.container;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            // Вход в полноэкранный режим
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
            // Скрываем сайдбар и шапку
            document.getElementById('sidebar')?.classList.add('fullscreen-mode');
            document.querySelector('.chat-header')?.classList.add('fullscreen-mode');
            if (gameContainer) {
                gameContainer.style.transform = 'scale(1.2)';
                gameContainer.style.transformOrigin = 'center center';
            }
            this.app?.toast.info('Полноэкранный режим включён', 1500);
        } else {
            // Выход
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            // Восстановление произойдёт автоматически через обработчик fullscreenchange
        }        
    }    

    // Добавлено в 5.1: обновлённый setup для новых игр    
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