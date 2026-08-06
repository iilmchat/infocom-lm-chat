// src/games/snake-game.js

/**
 * Игра Змейка
 */
export class SnakeGame {
    constructor(container) {
        this.c = container;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 300;
        this.canvas.height = 300;
        this.ctx = this.canvas.getContext('2d');
        this.c.appendChild(this.canvas);

        this.gridSize = 15;
        this.tileSize = 20;
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.snake = [{ x: 7, y: 7 }];
        this.food = this.spawnFood();
        this.score = 0;
        this.level = 1;
        this.best = parseInt(localStorage.getItem('snake_best') || '0');
        this.loop = null;
        this.gameOver = false;
        this.paused = false;
        this.started = false;
        this.render();
    }

    spawnFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * this.gridSize),
                y: Math.floor(Math.random() * this.gridSize)
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
        return food;
    }

    update() {
        if (this.gameOver || this.paused || !this.started) return;

        this.dir = { ...this.nextDir };
        const head = {
            x: this.snake[0].x + this.dir.x,
            y: this.snake[0].y + this.dir.y
        };

        if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize ||
            this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.end();
            return;
        }

        this.snake.unshift(head);

        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            if (this.score > this.best) {
                this.best = this.score;
                localStorage.setItem('snake_best', this.best.toString());
            }
            const newLevel = Math.min(Math.floor(this.score / 50) + 1, 10);
            if (newLevel > this.level) {
                this.level = newLevel;
                this.restartLoop();
                if (window.app?.toast) {
                    window.app.toast.success(`🎉 Уровень ${this.level}!`, 1500);
                }
            }
            this.food = this.spawnFood();
        } else {
            this.snake.pop();
        }

        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 300, 300);

        this.snake.forEach((segment, index) => {
            ctx.fillStyle = index === 0 ? '#4caf50' : '#66bb6a';
            ctx.fillRect(segment.x * 20 + 1, segment.y * 20 + 1, 18, 18);
        });

        ctx.fillStyle = '#ff5252';
        ctx.beginPath();
        ctx.arc(this.food.x * 20 + 10, this.food.y * 20 + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        const info = document.getElementById('snakeInfo');
        if (info) {
            info.innerHTML = `Счёт: <strong>${this.score}</strong> | Ур. ${this.level}/10`;
        }
    }

    setDir(x, y) {
        if (this.dir.x !== -x || this.dir.y !== -y) {
            this.nextDir = { x, y };
        }
    }

    start() {
        if (this.gameOver) return;
        this.started = true;
        this.paused = false;
        if (!this.loop) {
            this.loop = setInterval(() => this.update(), 240);
        }
        this.render();
    }

    togglePause() {
        this.paused = !this.paused;
        this.render();
    }

    restartLoop() {
        clearInterval(this.loop);
        const speed = Math.max(60, 240 - (this.level - 1) * 6);
        this.loop = setInterval(() => this.update(), speed);
    }

    end() {
        this.gameOver = true;
        clearInterval(this.loop);
        this.loop = null;
        if (window.app?.toast) {
            window.app.toast.warning(`Змейка: ${this.score} очков`);
        }
        this.render();
    }

    newGame() {
        clearInterval(this.loop);
        this.loop = null;
        this.gameOver = false;
        this.paused = false;
        this.started = false;
        this.snake = [{ x: 7, y: 7 }];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.score = 0;
        this.level = 1;
        this.food = this.spawnFood();
        this.render();
    }
}