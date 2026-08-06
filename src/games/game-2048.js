// src/games/game-2048.js

/**
 * Игра 2048
 */
export class Game2048 {
    constructor(container, size = 4) {
        this.c = container;
        this.size = size;
        this.grid = [];
        this.score = 0;
        this.best = parseInt(localStorage.getItem('g2048_' + size) || '0');
        this.init();
    }

    init() {
        this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
        this.score = 0;
        this.add();
        this.add();
    }

    add() {
        const emptyCells = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] === 0) {
                    emptyCells.push({ r, c });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    slide(row) {
        let filteredRow = row.filter(v => v !== 0);
        
        for (let i = 0; i < filteredRow.length - 1; i++) {
            if (filteredRow[i] === filteredRow[i + 1]) {
                filteredRow[i] *= 2;
                this.score += filteredRow[i];
                filteredRow.splice(i + 1, 1);
            }
        }

        while (filteredRow.length < this.size) {
            filteredRow.push(0);
        }

        return filteredRow;
    }

    move(direction) {
        const oldGrid = this.grid.map(r => [...r]);

        if (direction === 'left') {
            for (let r = 0; r < this.size; r++) {
                this.grid[r] = this.slide(this.grid[r]);
            }
        } else if (direction === 'right') {
            for (let r = 0; r < this.size; r++) {
                const reversedRow = [...this.grid[r]].reverse();
                this.grid[r] = this.slide(reversedRow).reverse();
            }
        } else if (direction === 'up') {
            for (let c = 0; c < this.size; c++) {
                const col = this.grid.map(r => r[c]);
                const newRow = this.slide(col);
                for (let r = 0; r < this.size; r++) {
                    this.grid[r][c] = newRow[r];
                }
            }
        } else if (direction === 'down') {
            for (let c = 0; c < this.size; c++) {
                const col = this.grid.map(r => r[c]).reverse();
                const newRow = this.slide(col).reverse();
                for (let r = 0; r < this.size; r++) {
                    this.grid[r][c] = newRow[r];
                }
            }
        }

        let moved = false;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] !== oldGrid[r][c]) {
                    moved = true;
                    break;
                }
            }
            if (moved) break;
        }

        if (moved) {
            this.add();
            if (this.score > this.best) {
                this.best = this.score;
                localStorage.setItem('g2048_' + this.size, this.best.toString());
            }
        }

        this.render();
    }

    render() {
        const colors = {
            0: '#cdc1b4',
            2: '#eee4da',
            4: '#ede0c8',
            8: '#f2b179',
            16: '#f59563',
            32: '#f67c5f',
            64: '#f65e3b',
            128: '#edcf72',
            256: '#edcc61',
            512: '#edc850',
            1024: '#edc53f',
            2048: '#edc22e'
        };

        let html = `
            <div style="margin-bottom:4px;font-size:12px;">
                Счёт: <strong>${this.score}</strong> | ${this.size}×${this.size}
            </div>
            <div style="display:grid;grid-template-columns:repeat(${this.size},1fr);gap:3px;background:#bbada0;padding:3px;border-radius:6px;max-width:${this.size * 58}px;margin:0 auto;">
        `;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const value = this.grid[r][c];
                const color = colors[value] || '#3c3a32';
                const textColor = value <= 4 ? '#776e65' : '#fff';
                const fontSize = this.size <= 4 ? '16px' : '11px';

                html += `
                    <div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-weight:700;border-radius:3px;background:${color};color:${textColor};font-size:${fontSize};">
                        ${value || ''}
                    </div>
                `;
            }
        }

        html += '</div>';

        html += `
            <div style="margin-top:6px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                ${[3, 4, 5, 6, 8].map(s => `
                    <button onclick="window.gameView?.currentGame?.resize(${s})" 
                            style="padding:3px 8px;border-radius:4px;border:1px solid var(--border-color);background:${this.size === s ? 'var(--text-accent)' : 'var(--bg-primary)'};color:${this.size === s ? 'var(--bg-primary)' : 'var(--text-primary)'};cursor:pointer;font-size:10px;">
                        ${s}×${s}
                    </button>
                `).join('')}
                <button onclick="window.gameView?.currentGame?.newGame()" 
                        style="padding:3px 10px;border-radius:4px;border:none;background:var(--send-btn-bg);color:#fff;cursor:pointer;font-size:10px;">
                    🔄 Новая
                </button>
            </div>
        `;

        this.c.innerHTML = html;
    }

    resize(size) {
        this.size = size;
        this.best = parseInt(localStorage.getItem('g2048_' + size) || '0');
        this.init();
        this.render();
    }

    newGame() {
        this.init();
        this.render();
    }
}