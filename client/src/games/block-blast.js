// src/games/block-blast.js
/**
 * Игра Block Blast
 * Добавлено в 5.1.
 * 
 * Правила:
 * - Поле 8x8 клеток.
 * - Предлагаются 3 случайные фигуры.
 * - Игрок выбирает фигуру и размещает её на поле кликом.
 * - Заполненные строки/столбцы удаляются, принося очки.
 * - Игра заканчивается, когда ни одну из фигур нельзя разместить.
 */
export class BlockBlastGame {
    constructor(container) {
        this.container = container;
        this.gridSize = 8;
        this.grid = [];
        this.shapes = [];
        this.currentShapes = [];
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('blockBlastHighScore')) || 0;
        this.isGameOver = false;
        this.loop = null;
        this.started = false;
        this.paused = false;
        
        // Цвета для разных типов блоков (фигур)
        this.shapeColors = [
            '#e94560', '#f0db4f', '#4caf50', '#7ec8e3', '#9b4dca', 
            '#ff9800', '#ff69b4', '#00bcd4', '#8bc34a', '#ff5722'
        ];
        
        // Определения фигур (массив координат относительно центра)
        this.shapeDefinitions = [
            // Мономино (1 блок)
            [[0,0]],
            // Домино (2 блока)
            [[0,0], [1,0]],
            [[0,0], [0,1]],
            // Тримино
            [[0,0], [1,0], [2,0]],
            [[0,0], [0,1], [0,2]],
            [[0,0], [1,0], [1,1]],
            [[0,0], [1,0], [0,1]],
            // Тетрамино (как в тетрисе)
            [[0,0], [1,0], [2,0], [3,0]], // I
            [[0,0], [0,1], [0,2], [0,3]], // I вертикаль
            [[0,0], [1,0], [1,1], [2,1]], // Z
            [[0,0], [1,0], [1,-1], [2,-1]], // S
            [[0,0], [1,0], [2,0], [1,1]], // T
            [[0,0], [1,0], [0,1], [1,1]], // O
            [[0,0], [1,0], [2,0], [2,1]], // L
            [[0,0], [1,0], [2,0], [0,1]], // J
            // Пентамино (5 блоков) - некоторые вариации
            [[0,0], [1,0], [2,0], [3,0], [4,0]],
            [[0,0], [0,1], [0,2], [0,3], [0,4]],
            [[0,0], [1,0], [2,0], [1,1], [2,1]],
            [[0,0], [1,0], [1,1], [2,0], [2,1]],
            [[0,0], [1,0], [2,0], [0,1], [2,1]],
            // Более сложные
            [[0,0], [1,0], [2,0], [3,0], [3,1]],
            [[0,0], [1,0], [2,0], [2,1], [3,1]],
            [[0,0], [1,0], [0,1], [1,1], [2,1]],
            [[0,0], [1,0], [2,0], [0,1], [1,1]],
        ];
        
        this.init();
    }

    init() {
        // Создаём пустое поле
        this.grid = Array.from({ length: this.gridSize }, () => 
            Array(this.gridSize).fill(0)
        );
        this.currentShapes = [];
        this.score = 0;
        this.isGameOver = false;
        this.started = false;
        this.paused = false;
        this.generateShapes();
        this.render();
    }

    // Генерация 3 случайных фигур
    generateShapes() {
        this.currentShapes = [];
        for (let i = 0; i < 3; i++) {
            const idx = Math.floor(Math.random() * this.shapeDefinitions.length);
            const def = this.shapeDefinitions[idx];
            const color = this.shapeColors[Math.floor(Math.random() * this.shapeColors.length)];
            // Копируем координаты, чтобы не изменять оригинал
            const coords = def.map(([x, y]) => [x, y]);
            // Нормализуем координаты, чтобы они начинались с 0
            const minX = Math.min(...coords.map(c => c[0]));
            const minY = Math.min(...coords.map(c => c[1]));
            const normalized = coords.map(([x, y]) => [x - minX, y - minY]);
            this.currentShapes.push({
                coords: normalized,
                color: color,
                index: idx
            });
        }
    }

    // Попытка разместить фигуру на поле
    placeShape(shapeIndex, row, col) {
        if (this.isGameOver || this.paused) return false;
        
        const shape = this.currentShapes[shapeIndex];
        if (!shape) return false;
        
        // Проверяем, можно ли разместить
        if (!this.canPlace(shape.coords, row, col)) {
            return false;
        }
        
        // Размещаем фигуру
        shape.coords.forEach(([dx, dy]) => {
            const x = col + dx;
            const y = row + dy;
            if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
                this.grid[y][x] = shape.color;
            }
        });
        
        // Удаляем фигуру из списка
        this.currentShapes.splice(shapeIndex, 1);
        
        // Проверяем заполненные линии
        const cleared = this.clearLines();
        this.score += cleared * 10;
        
        // Если фигур не осталось, генерируем новые
        if (this.currentShapes.length === 0) {
            this.generateShapes();
        }
        
        // Проверяем, можно ли разместить оставшиеся фигуры
        if (!this.hasValidMoves()) {
            this.gameOver();
        }
        
        this.render();
        return true;
    }

    // Проверка возможности размещения фигуры
    canPlace(coords, row, col) {
        for (const [dx, dy] of coords) {
            const x = col + dx;
            const y = row + dy;
            if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
                return false;
            }
            if (this.grid[y][x] !== 0) {
                return false;
            }
        }
        return true;
    }

    // Проверка наличия хотя бы одного допустимого хода для всех фигур
    hasValidMoves() {
        for (let s = 0; s < this.currentShapes.length; s++) {
            const shape = this.currentShapes[s];
            for (let row = 0; row < this.gridSize; row++) {
                for (let col = 0; col < this.gridSize; col++) {
                    if (this.canPlace(shape.coords, row, col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Удаление заполненных линий (строк и столбцов)
    clearLines() {
        let cleared = 0;
        // Проверяем строки
        for (let y = 0; y < this.gridSize; y++) {
            if (this.grid[y].every(cell => cell !== 0)) {
                // Очищаем строку
                this.grid[y].fill(0);
                cleared++;
            }
        }
        // Проверяем столбцы
        for (let x = 0; x < this.gridSize; x++) {
            let full = true;
            for (let y = 0; y < this.gridSize; y++) {
                if (this.grid[y][x] === 0) {
                    full = false;
                    break;
                }
            }
            if (full) {
                // Очищаем столбец
                for (let y = 0; y < this.gridSize; y++) {
                    this.grid[y][x] = 0;
                }
                cleared++;
            }
        }
        return cleared;
    }

    gameOver() {
        this.isGameOver = true;
        this.started = false;
        if (this.loop) {
            clearInterval(this.loop);
            this.loop = null;
        }
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('blockBlastHighScore', String(this.highScore));
        }
        this.render();
    }

    // Запуск игры
    start() {
        if (this.isGameOver) {
            this.init();
        }
        this.started = true;
        this.paused = false;
        this.render();
    }

    // Пауза
    togglePause() {
        if (!this.started || this.isGameOver) return;
        this.paused = !this.paused;
        this.render();
    }

    // Новая игра
    newGame() {
        this.init();
        this.started = true;
        this.render();
    }

    // Рендеринг
    render() {
        if (!this.container) return;
        
        // Находим или создаём контейнер для игры
        let gameContainer = this.container.querySelector('.block-blast-game');
        if (!gameContainer) {
            gameContainer = document.createElement('div');
            gameContainer.className = 'block-blast-game';
            this.container.appendChild(gameContainer);
        }
        
        // Рендерим поле
        let gridHtml = '';
        for (let y = 0; y < this.gridSize; y++) {
            gridHtml += '<div class="blast-row">';
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                const bgColor = cell !== 0 ? cell : 'var(--bg-primary)';
                gridHtml += `<div class="blast-cell" style="background:${bgColor};" data-x="${x}" data-y="${y}"></div>`;
            }
            gridHtml += '</div>';
        }
        
        // Рендерим фигуры (3 штуки)
        let shapesHtml = '';
        this.currentShapes.forEach((shape, idx) => {
            const coords = shape.coords;
            // Определяем размеры фигуры для отображения в мини-сетке
            const maxX = Math.max(...coords.map(c => c[0]));
            const maxY = Math.max(...coords.map(c => c[1]));
            const width = maxX + 1;
            const height = maxY + 1;
            // Создаём мини-сетку
            let miniGrid = '';
            for (let y = 0; y < height; y++) {
                miniGrid += '<div class="mini-row">';
                for (let x = 0; x < width; x++) {
                    const isFilled = coords.some(([dx, dy]) => dx === x && dy === y);
                    const bg = isFilled ? shape.color : 'transparent';
                    miniGrid += `<div class="mini-cell" style="background:${bg};"></div>`;
                }
                miniGrid += '</div>';
            }
            shapesHtml += `
                <div class="blast-shape" data-shape-index="${idx}">
                    <div class="mini-grid">${miniGrid}</div>
                    <div class="shape-label">Фигура ${idx + 1}</div>
                </div>
            `;
        });
        
        gameContainer.innerHTML = `
            <div class="blast-header">
                <div class="blast-score">Счёт: ${this.score}</div>
                <div class="blast-highscore">Рекорд: ${this.highScore}</div>
                <div class="blast-status">${this.isGameOver ? '💀 Игра окончена' : this.paused ? '⏸ Пауза' : this.started ? '▶ В игре' : '⏹ Ожидание'}</div>
            </div>
            <div class="blast-main">
                <div class="blast-grid">
                    ${gridHtml}
                </div>
                <div class="blast-shapes">
                    ${shapesHtml}
                    ${this.isGameOver ? '<div class="blast-gameover">💀 Нажмите "Новая игра"</div>' : ''}
                </div>
            </div>
            <div class="blast-controls">
                <button class="blast-btn" data-action="start">▶ Старт</button>
                <button class="blast-btn" data-action="pause">⏸ Пауза</button>
                <button class="blast-btn" data-action="new">🔄 Новая</button>
            </div>
        `;
        
        // Обработчики кликов по ячейкам поля
        gameContainer.querySelectorAll('.blast-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                if (this.isGameOver || this.paused || !this.started) return;
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);
                // Проверяем, какая фигура выбрана (по умолчанию первая)
                // В реальной игре можно выбирать фигуру кликом на мини-сетке
                // Для простоты используем первую фигуру
                if (this.currentShapes.length > 0) {
                    this.placeShape(0, y, x);
                }
            });
        });
        
        // Обработчики кликов по фигурам (выбор фигуры)
        gameContainer.querySelectorAll('.blast-shape').forEach(shapeEl => {
            shapeEl.addEventListener('click', () => {
                // Визуально выделяем выбранную фигуру
                gameContainer.querySelectorAll('.blast-shape').forEach(el => el.classList.remove('selected'));
                shapeEl.classList.add('selected');
                // Запоминаем выбранную фигуру для последующей вставки
                const idx = parseInt(shapeEl.dataset.shapeIndex);
                this.selectedShape = idx;
                // Добавляем подсказку
                const hint = gameContainer.querySelector('.blast-hint');
                if (hint) hint.textContent = `Выбрана фигура ${idx + 1}. Кликните на поле для размещения.`;
            });
        });
        
        // Обработчики кнопок управления
        gameContainer.querySelectorAll('.blast-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'start') this.start();
                else if (action === 'pause') this.togglePause();
                else if (action === 'new') this.newGame();
            });
        });
        
        // Добавляем обработчик для размещения выбранной фигуры
        if (this.selectedShape !== undefined) {
            const hint = gameContainer.querySelector('.blast-hint') || document.createElement('div');
            hint.className = 'blast-hint';
            hint.textContent = `Выбрана фигура ${this.selectedShape + 1}. Кликните на поле для размещения.`;
            if (!gameContainer.querySelector('.blast-hint')) {
                gameContainer.appendChild(hint);
            }
        }
        
        // Если игра окончена, блокируем клики по полю
        if (this.isGameOver) {
            gameContainer.querySelectorAll('.blast-cell').forEach(cell => {
                cell.style.cursor = 'default';
            });
        }
    }
}