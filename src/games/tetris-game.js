// src/games/tetris-game.js

/**
 * Игра Тетрис
 */
export class TetrisGame {
    constructor(container) {
        this.c = container;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 200;
        this.canvas.height = 360;
        this.ctx = this.canvas.getContext('2d');
        this.c.appendChild(this.canvas);

        this.cols = 10;
        this.rows = 18;
        this.tileSize = 20;
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));

        this.pieces = {
            I: [[1, 1, 1, 1]],
            O: [[1, 1], [1, 1]],
            T: [[0, 1, 0], [1, 1, 1]],
            S: [[0, 1, 1], [1, 1, 0]],
            Z: [[1, 1, 0], [0, 1, 1]],
            J: [[1, 0, 0], [1, 1, 1]],
            L: [[0, 0, 1], [1, 1, 1]]
        };

        this.colors = {
            I: '#00bcd4',
            O: '#ffeb3b',
            T: '#9c27b0',
            S: '#4caf50',
            Z: '#f44336',
            J: '#2196f3',
            L: '#ff9800'
        };

        this.cur = null;
        this.curName = '';
        this.curPos = { x: 0, y: 0 };
        this.score = 0;
        this.best = parseInt(localStorage.getItem('tetris_best') || '0');
        this.loop = null;
        this.gameOver = false;
        this.paused = false;
        this.started = false;
        this.spawn();
        this.render();
    }

    spawn() {
        const names = Object.keys(this.pieces);
        this.curName = names[Math.floor(Math.random() * names.length)];
        this.cur = this.pieces[this.curName];
        this.curPos = {
            x: Math.floor(this.cols / 2) - Math.floor(this.cur[0].length / 2),
            y: 0
        };
        if (this.collision()) this.end();
    }

    collision() {
        for (let r = 0; r < this.cur.length; r++) {
            for (let c = 0; c < this.cur[r].length; c++) {
                if (this.cur[r][c]) {
                    const x = this.curPos.x + c;
                    const y = this.curPos.y + r;
                    if (x < 0 || x >= this.cols || y >= this.rows || (y >= 0 && this.board[y][x])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    merge() {
        for (let r = 0; r < this.cur.length; r++) {
            for (let c = 0; c < this.cur[r].length; c++) {
                if (this.cur[r][c]) {
                    const y = this.curPos.y + r;
                    if (y < 0) {
                        this.end();
                        return;
                    }
                    this.board[y][this.curPos.x + c] = this.curName;
                }
            }
        }
    }

    clearLines() {
        let cleared = 0;
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r].every(c => c !== 0)) {
                this.board.splice(r, 1);
                this.board.unshift(Array(this.cols).fill(0));
                cleared++;
                r++;
            }
        }
        if (cleared > 0) {
            const points = [0, 100, 300, 500, 800];
            this.score += points[cleared] || 0;
            if (this.score > this.best) {
                this.best = this.score;
                localStorage.setItem('tetris_best', this.best.toString());
            }
        }
    }

    move(dx) {
        if (!this.started || this.paused || this.gameOver) return;
        this.curPos.x += dx;
        if (this.collision()) this.curPos.x -= dx;
        this.render();
    }

    rotate() {
        if (!this.started || this.paused || this.gameOver) return;
        const rotated = this.cur[0].map((_, i) => this.cur.map(row => row[i]).reverse());
        const old = this.cur;
        this.cur = rotated;
        if (this.collision()) this.cur = old;
        this.render();
    }

    drop() {
        if (!this.started || this.paused || this.gameOver) return;
        this.curPos.y++;
        if (this.collision()) {
            this.curPos.y--;
            this.merge();
            this.clearLines();
            this.spawn();
        }
        this.render();
    }

    hardDrop() {
        if (!this.started || this.paused || this.gameOver) return;
        while (!this.collision()) this.curPos.y++;
        this.curPos.y--;
        this.merge();
        this.clearLines();
        this.spawn();
        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 200, 360);

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.5;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                ctx.strokeRect(c * 20, r * 20, 20, 20);
            }
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c]) {
                    ctx.fillStyle = this.colors[this.board[r][c]] || '#888';
                    ctx.fillRect(c * 20 + 1, r * 20 + 1, 18, 18);
                }
            }
        }

        if (this.cur && !this.gameOver) {
            for (let r = 0; r < this.cur.length; r++) {
                for (let c = 0; c < this.cur[r].length; c++) {
                    if (this.cur[r][c]) {
                        ctx.fillStyle = this.colors[this.curName];
                        ctx.fillRect((this.curPos.x + c) * 20 + 1, (this.curPos.y + r) * 20 + 1, 18, 18);
                    }
                }
            }
        }

        const info = document.getElementById('tetrisInfo');
        if (info) {
            info.innerHTML = `Счёт: <strong>${this.score}</strong> | Рекорд: ${this.best}`;
        }
    }

    start() {
        if (this.gameOver) return;
        this.started = true;
        this.paused = false;
        if (!this.loop) {
            this.loop = setInterval(() => this.drop(), 500);
        }
        this.render();
    }

    togglePause() {
        this.paused = !this.paused;
        this.render();
    }

    end() {
        this.gameOver = true;
        clearInterval(this.loop);
        this.loop = null;
        if (window.app?.toast) {
            window.app.toast.warning(`Тетрис: ${this.score} очков`);
        }
        this.render();
    }

    newGame() {
        clearInterval(this.loop);
        this.loop = null;
        this.gameOver = false;
        this.paused = false;
        this.started = false;
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.spawn();
        this.render();
    }
}