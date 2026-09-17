// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 1: Базовый движок и рендеринг
 * Спринт 2: Пассажиры и базовая логика
 * Спринт 3: Создание линий, движение поездов, перевозка пассажиров
 * Спринт 4: Улучшения и ресурсы (недели, выбор бонусов)
 * 
 * Изменено в спринте 5:
 * - Добавлена процедурная генерация новых станций (по одной в неделю)
 * - Добавлено условие поражения: станция переполнена > 10 секунд
 * - Добавлен экран Game Over с финальным счётом
 */
export class MiniMetroGame {
    // ======================== КОНСТРУКТОР ========================
    constructor(container) {
        this.container = container;

        // --- Холст ---
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // --- Отображение счёта и недели ---
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.style.cssText = 'text-align:center;font-size:16px;margin-top:8px;color:var(--text-primary);';
        this.scoreDisplay.textContent = '🚇 Перевезено: 0 | Неделя: 1';
        this.container.appendChild(this.scoreDisplay);

        // --- Размеры ---
        this.width = 0;
        this.height = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // --- Состояние игры ---
        this.stations = [];
        this.lines = [];
        this.trains = [];
        this.score = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationId = null;
        // Добавлено в спринте 5: флаг окончания игры
        this.isGameOver = false;

        // --- Таймер генерации пассажиров ---
        this.passengerTimer = 0;
        this.passengerInterval = 60;

        // --- Рисование линии ---
        this.isDrawing = false;
        this.currentLineStations = [];
        this.tempLinePoints = [];
        this.currentColor = null;
        this.colorIndex = 0;
        this.lineColors = [
            '#ff6b6b', 
            '#4ecdc4', 
            '#ffe66d', 
            '#a29bfe',
            '#fd79a8', 
            '#fdcb6e', 
            '#00b894', 
            '#74b9ff'
        ];

        // --- Система улучшений ---
        this.maxLines = 3;
        this.bridgeCount = 0;
        this.week = 1;
        this.weekDuration = 600;       // ~10 сек при 60fps
        this.weekTimer = 0;
        this.isWeekEnd = false;
        this.pendingUpgrades = null;

        // --- Модальное окно выбора улучшений ---
        this.setupUpgradeModal();

        // --- Добавлено в спринте 5: настройка экрана Game Over ---
        this.setupGameOverOverlay();

        // --- Инициализация ---
        this.initStations();
        this.setupMouseEvents();
        this.draw();
    }

    // ======================== РАЗМЕРЫ ========================
    resize() {
        const rect = this.container.getBoundingClientRect();
        const padding = 20;
        let w = rect.width - padding * 2;
        let h = Math.min(rect.height - padding * 2, 600);
        if (w < 200) w = 200;
        if (h < 200) h = 200;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    // ======================== СТАНЦИИ ========================
    initStations() {
        const types = ['circle', 'square', 'triangle'];
        const count = 3;
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = 60;

        this.stations = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            this.stations.push({
                x, y,
                type: types[i % types.length],
                capacity: 10,
                passengers: [],
                shape: types[i % types.length],
                // Добавлено в спринте 5: используется для подсчёта времени переполнения
                overflowTimer: 0 // Добавлено в спринте 5: используется для подсчёта времени переполнения
            });
        }
    }

    // ======================== ГЕНЕРАЦИЯ НОВЫХ СТАНЦИЙ (Добавлено в спринте 5) ========================

    /**
     * Создаёт новую станцию в случайном месте, но не слишком близко к существующим.
     * Возвращает true, если удалось создать, иначе false.
     */
    addNewStation() {
        const types = ['circle', 'square', 'triangle', 'diamond']; // добавим ромб для разнообразия
        const type = types[Math.floor(Math.random() * types.length)];
        const padding = 40;
        const minDist = 100; // минимальное расстояние до других станций

        let attempts = 50;
        let x, y, ok;

        while (attempts-- > 0) {
            x = padding + Math.random() * (this.width - 2 * padding);
            y = padding + Math.random() * (this.height - 2 * padding);
            ok = true;
            for (const s of this.stations) {
                const dx = x - s.x;
                const dy = y - s.y;
                if (dx * dx + dy * dy < minDist * minDist) {
                    ok = false;
                    break;
                }
            }
            if (ok) break;
        }

        if (!ok) {
            // Не удалось найти место — пробуем расширить поиск или пропускаем
            return false;
        }

        const newStation = {
            x, y,
            type: type,
            capacity: 10,
            passengers: [],
            shape: type,
            overflowTimer: 0
        };
        this.stations.push(newStation);
        return true;
    }

    // ======================== ПАССАЖИРЫ ========================
    generatePassenger() {
        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
        if (!station) return;
        if (station.passengers.length >= station.capacity) return;

        const types = ['circle', 'square', 'triangle', 'diamond'];
        const available = types.filter(t => t !== station.type);
        const destType = available[Math.floor(Math.random() * available.length)];

        station.passengers.push({ type: destType });
    }

    // ======================== ЛИНИИ И ПОЕЗДА ========================

    /**
     * Создаёт новую линию из переданного массива станций.
     * Присваивает ей цвет, создаёт поезд и добавляет в списки.
     */
    createLine(stationsArray) {
        if (this.lines.length >= this.maxLines) {
            return null;
        }
        if (stationsArray.length < 2) return null;

        const color = this.lineColors[this.colorIndex % this.lineColors.length];
        this.colorIndex++;

        const line = {
            stations: stationsArray.slice(),
            color: color,
            train: null
        };

        const train = {
            line: line,
            currentStationIndex: 0,
            progress: 0,
            direction: 1,
            passengers: [],
            capacity: 6
        };

        line.train = train;
        this.lines.push(line);
        this.trains.push(train);
        return line;
    }

    /**
     * Обновление движения всех поездов.
     * Алгоритм:
     *  - Для каждого поезда увеличиваем progress на скорость.
     *  - Если progress >= 1, переходим к следующей станции:
     *      - Высадка пассажиров, чей тип совпадает с типом текущей станции (увеличиваем счёт).
     *      - Посадка пассажиров со станции, если их тип есть на маршруте впереди.
     *      - Обновляем currentStationIndex с учётом направления, сбрасываем progress.
     *      - Если достигнут конец линии, меняем направление.
     */
    updateTrains() {
        const speed = 0.005;

        for (const train of this.trains) {
            const line = train.line;
            const stations = line.stations;
            if (stations.length < 2) continue;

            train.progress += speed * train.direction;

            if (train.progress >= 1) {
                train.progress = 0;
                let nextIndex = train.currentStationIndex + train.direction;

                if (nextIndex < 0 || nextIndex >= stations.length) {
                    train.direction *= -1;
                    nextIndex = train.currentStationIndex + train.direction;
                    if (nextIndex < 0 || nextIndex >= stations.length) continue;
                }

                train.currentStationIndex = nextIndex;
                const currentStation = stations[train.currentStationIndex];

                // ----- ВЫСАДКА пассажиров -----
                const toRemove = [];
                for (let i = 0; i < train.passengers.length; i++) {
                    if (train.passengers[i].type === currentStation.type) {
                        toRemove.push(i);
                        this.score++;
                    }
                }
                for (let i = toRemove.length - 1; i >= 0; i--) {
                    train.passengers.splice(toRemove[i], 1);
                }

                // ----- ПОСАДКА пассажиров со станции -----
                const futureTypes = new Set();
                let idx = train.currentStationIndex + train.direction;
                while (idx >= 0 && idx < stations.length) {
                    futureTypes.add(stations[idx].type);
                    idx += train.direction;
                }

                const stationPassengers = currentStation.passengers;
                const toBoard = [];
                for (let i = 0; i < stationPassengers.length; i++) {
                    const p = stationPassengers[i];
                    if (futureTypes.has(p.type) && train.passengers.length < train.capacity) {
                        toBoard.push(i);
                    }
                }
                for (let i = toBoard.length - 1; i >= 0; i--) {
                    const idxPass = toBoard[i];
                    const passenger = stationPassengers.splice(idxPass, 1)[0];
                    train.passengers.push(passenger);
                }
            }
        }
    }

    // ======================== ОБНОВЛЕНИЕ ИГРЫ ========================
    update() {
        // 1. Генерация пассажиров
        this.passengerTimer++;
        if (this.passengerTimer >= this.passengerInterval) {
            this.passengerTimer = 0;
            const count = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this.generatePassenger();
            }
        }

        // 2. Движение поездов
        this.updateTrains();

        // 3. Обновление недели (только если игра не на паузе и не в режиме выбора и не геймовер)
        if (!this.isPaused && this.isRunning && !this.isWeekEnd && !this.isGameOver) {
            this.weekTimer++;
            if (this.weekTimer >= this.weekDuration) {
                this.weekTimer = 0;
                this.endWeek();
            }
        }

        // 4. Проверка переполнения станций (Добавлено в спринте 5)
        if (!this.isGameOver && this.isRunning) {
            let anyOverflow = false;
            const overflowThreshold = 10 * 60; // 10 секунд при 60fps

            for (const station of this.stations) {
                if (station.passengers.length > station.capacity) {
                    // Станция переполнена — увеличиваем таймер
                    station.overflowTimer += 1;
                    anyOverflow = true;
                    if (station.overflowTimer >= overflowThreshold) {
                        // Поражение!
                        this.gameOver();
                        return;
                    }
                } else {
                    // Сбрасываем таймер, если пассажиров не больше вместимости
                    station.overflowTimer = 0;
                }
            }
        }

        // 5. Обновление счётчика
        this.updateScoreDisplay();
    }

    /**
     * Завершение недели: генерируем два случайных улучшения и показываем модальное окно.
     * Игра ставится на паузу.
     * Добавлено в спринте 5: также добавляем новую станцию.
     */
    endWeek() {
        // Добавлено в спринте 5: добавляем новую станцию в начале каждой недели
        const stationAdded = this.addNewStation();
        if (stationAdded) {
            // Можно показать уведомление (но у нас нет тостов внутри игры, пока просто игнорируем)
        }

        const upgradeTypes = ['line', 'carriage', 'bridge', 'interchange'];
        const shuffled = upgradeTypes.sort(() => Math.random() - 0.5);
        const options = shuffled.slice(0, 2);

        this.pendingUpgrades = options;
        this.isWeekEnd = true;

        this.isPaused = true;

        this.showUpgradeModal(options);

        this.week++;
        this.updateScoreDisplay();
    }

    // ======================== УЛУЧШЕНИЯ ========================

    /**
     * Применяет выбранное улучшение.
     * @param {string} type - 'line', 'carriage', 'bridge', 'interchange'
     */
    applyUpgrade(type) {
        switch (type) {
            case 'line':
                this.maxLines += 1;
                break;
            case 'carriage':
                if (this.trains.length > 0) {
                    const train = this.trains[Math.floor(Math.random() * this.trains.length)];
                    train.capacity += 2;
                }
                break;
            case 'bridge':
                this.bridgeCount += 1;
                break;
            case 'interchange':
                if (this.stations.length > 0) {
                    const station = this.stations[Math.floor(Math.random() * this.stations.length)];
                    station.capacity += 3;
                }
                break;
            default:
                break;
        }
        this.hideUpgradeModal();
        this.isPaused = false;
        this.isWeekEnd = false;
        this.pendingUpgrades = null;
        if (this.isRunning && !this.isGameOver) {
            this.loop();
        }
    }

    // ======================== МОДАЛЬНОЕ ОКНО УЛУЧШЕНИЙ ========================

    setupUpgradeModal() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10;
            backdrop-filter: blur(4px);
            border-radius: 8px;
        `;

        this.modalContent = document.createElement('div');
        this.modalContent.style.cssText = `
            background: var(--bg-secondary, #2d2d44);
            padding: 24px;
            border-radius: 16px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            text-align: center;
            color: var(--text-primary);
        `;
        this.modalContent.innerHTML = `
            <h2 style="margin:0 0 12px 0;">🏆 Неделя ${this.week + 1}</h2>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">Выберите улучшение:</p>
            <div id="upgradeOptions" style="display:flex; flex-direction:column; gap:8px;"></div>
        `;

        this.modalOverlay.appendChild(this.modalContent);
        this.container.style.position = 'relative';
        this.container.appendChild(this.modalOverlay);
    }

    showUpgradeModal(options) {
        const container = this.modalContent.querySelector('#upgradeOptions');
        container.innerHTML = '';
        const labels = {
            'line': '🚇 Новая линия (+1 к лимиту)',
            'carriage': '🚃 Вагон (+2 вместимости случайному поезду)',
            'bridge': '🌉 Мост (+1 мост)',
            'interchange': '🔄 Пересадочный узел (+3 вместимости станции)'
        };
        options.forEach(type => {
            const btn = document.createElement('button');
            btn.textContent = labels[type] || type;
            btn.style.cssText = `
                padding: 10px 16px;
                border: 2px solid var(--border-color);
                border-radius: 8px;
                background: var(--bg-primary);
                color: var(--text-primary);
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = 'var(--text-accent)';
                btn.style.background = 'var(--bg-accent)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = 'var(--border-color)';
                btn.style.background = 'var(--bg-primary)';
            });
            btn.addEventListener('click', () => {
                this.applyUpgrade(type);
            });
            container.appendChild(btn);
        });
        this.modalOverlay.style.display = 'flex';
    }

    hideUpgradeModal() {
        this.modalOverlay.style.display = 'none';
    }

    // ======================== ЭКРАН GAME OVER (Добавлено в спринте 5) ========================

    setupGameOverOverlay() {
        this.gameOverOverlay = document.createElement('div');
        this.gameOverOverlay.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.75);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 20;
            border-radius: 8px;
            flex-direction: column;
            color: #fff;
            font-family: sans-serif;
        `;
        this.gameOverOverlay.innerHTML = `
            <h1 style="font-size: 48px; margin: 0;">💥 GAME OVER</h1>
            <p style="font-size: 24px; margin: 16px 0;">Перевезено пассажиров: <span id="finalScore">0</span></p>
            <button id="restartFromGameOverBtn" style="
                padding: 12px 32px;
                font-size: 20px;
                border: none;
                border-radius: 8px;
                background: #4ecdc4;
                color: #1a1a2e;
                cursor: pointer;
                font-weight: bold;
                transition: background 0.2s;
            ">🔄 Новая игра</button>
        `;
        this.container.style.position = 'relative';
        this.container.appendChild(this.gameOverOverlay);

        // Обработчик кнопки перезапуска
        this.gameOverOverlay.querySelector('#restartFromGameOverBtn').addEventListener('click', () => {
            this.resetGame();
        });
    }

    showGameOver() {
        this.gameOverOverlay.querySelector('#finalScore').textContent = this.score;
        this.gameOverOverlay.style.display = 'flex';
        this.hideUpgradeModal(); // скрываем модалку улучшений, если она была открыта
    }

    hideGameOver() {
        this.gameOverOverlay.style.display = 'none';
    }

    // ======================== УСЛОВИЕ ПОРАЖЕНИЯ (Добавлено в спринте 5) ========================

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isRunning = false;
        this.isPaused = true; // останавливаем обновления
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.showGameOver();
        // Можно также обновить счётчик на экране
        this.updateScoreDisplay();
    }

    // ======================== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ========================
    updateScoreDisplay() {
        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = `🚇 Перевезено: ${this.score} | Неделя: ${this.week}`;
        }
    }

    // ======================== ОБРАБОТКА МЫШИ (СОЗДАНИЕ ЛИНИЙ) ========================
    setupMouseEvents() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
    }

    getStationAt(x, y) {
        const radius = 20;
        for (let i = 0; i < this.stations.length; i++) {
            const s = this.stations[i];
            const dx = x - s.x;
            const dy = y - s.y;
            if (dx*dx + dy*dy <= radius*radius) {
                return i;
            }
        }
        return -1;
    }

    onMouseDown(e) {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const stationIndex = this.getStationAt(mouseX, mouseY);

        if (stationIndex !== -1) {
            const station = this.stations[stationIndex];
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.currentLineStations = [station];
                this.tempLinePoints = [{ x: station.x, y: station.y }];
                this.currentColor = this.lineColors[this.colorIndex % this.lineColors.length];
            } else {
                const lastStation = this.currentLineStations[this.currentLineStations.length - 1];
                if (lastStation === station) return;
                if (this.currentLineStations.some(s => s === station)) {
                    return;
                }
                this.currentLineStations.push(station);
                this.tempLinePoints.push({ x: station.x, y: station.y });
            }
        } else {
            if (this.isDrawing && this.currentLineStations.length >= 2) {
                this.finishLine();
            } else {
                this.cancelDrawing();
            }
        }
        this.draw();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        this.tempLinePoints = this.currentLineStations.map(s => ({ x: s.x, y: s.y }));
        this.tempLinePoints.push({ x: mouseX, y: mouseY });
        this.draw();
    }

    onMouseUp(e) {}

    onDoubleClick(e) {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;
        if (this.isDrawing && this.currentLineStations.length >= 2) {
            this.finishLine();
        } else {
            this.cancelDrawing();
        }
        this.draw();
    }

    finishLine() {
        if (this.currentLineStations.length >= 2) {
            const line = this.createLine(this.currentLineStations);
            if (line) {
                this.isDrawing = false;
                this.currentLineStations = [];
                this.tempLinePoints = [];
                this.currentColor = null;
                this.draw();
            } else {
                this.cancelDrawing();
            }
        } else {
            this.cancelDrawing();
        }
    }

    cancelDrawing() {
        this.isDrawing = false;
        this.currentLineStations = [];
        this.tempLinePoints = [];
        this.currentColor = null;
        this.draw();
    }

    // ======================== ОТРИСОВКА ========================
    draw() {
        const ctx = this.ctx;
        const w = this.width, h = this.height;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // --- РИСОВАНИЕ ЛИНИЙ --- 
        for (const line of this.lines) {
            this.drawLine(ctx, line.stations, line.color, 3);
        }

        if (this.isDrawing && this.tempLinePoints.length >= 2) {
            const color = this.currentColor || '#ffffff';
            this.drawLine(ctx, this.tempLinePoints, color, 2, true);
        }

        // --- РИСОВАНИЕ ПОЕЗДОВ ---
        for (const train of this.trains) {
            const line = train.line;
            const stations = line.stations;
            if (stations.length < 2) continue;
            const idx = train.currentStationIndex;
            const nextIdx = idx + train.direction;
            if (nextIdx < 0 || nextIdx >= stations.length) continue;
            const from = stations[idx];
            const to = stations[nextIdx];
            const t = train.progress;
            const px = from.x + (to.x - from.x) * t;
            const py = from.y + (to.y - from.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = line.color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(train.passengers.length, px, py);
        }

        // --- РИСОВАНИЕ СТАНЦИЙ И ПАССАЖИРОВ ---
        for (const station of this.stations) {
            const x = station.x, y = station.y;
            const size = 20;

            // Если станция переполнена, рисуем красную окантовку (Добавлено в спринте 5)
            const isOverflow = station.passengers.length > station.capacity;
            ctx.fillStyle = isOverflow ? '#ff6b6b' : '#4fc3f7';
            ctx.strokeStyle = isOverflow ? '#ff0000' : '#ffffff';
            ctx.lineWidth = isOverflow ? 3 : 2;

            if (station.type === 'circle') {
                ctx.beginPath();
                ctx.arc(x, y, size/2, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();
            } else if (station.type === 'square') {
                ctx.fillRect(x - size/2, y - size/2, size, size);
                ctx.strokeRect(x - size/2, y - size/2, size, size);
            } else if (station.type === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(x, y - size/2);
                ctx.lineTo(x - size/2, y + size/2);
                ctx.lineTo(x + size/2, y + size/2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (station.type === 'diamond') { // Добавлено в спринте 5: новый тип
                ctx.beginPath();
                ctx.moveTo(x, y - size/2);
                ctx.lineTo(x + size/2, y);
                ctx.lineTo(x, y + size/2);
                ctx.lineTo(x - size/2, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            // Пассажиры (маленькие фигурки)
            const passengers = station.passengers;
            const maxDisplay = Math.min(passengers.length, 8);
            const angleStep = (Math.PI * 2) / Math.max(maxDisplay, 1);
            const radiusOffset = size/2 + 6;

            for (let i = 0; i < maxDisplay; i++) {
                const angle = angleStep * i;
                const px = x + radiusOffset * Math.cos(angle);
                const py = y + radiusOffset * Math.sin(angle);
                const pType = passengers[i].type;
                const pSize = 4;

                ctx.fillStyle = '#ffeb3b';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;

                if (pType === 'circle') {
                    ctx.beginPath();
                    ctx.arc(px, py, pSize, 0, Math.PI*2);
                    ctx.fill();
                    ctx.stroke();
                } else if (pType === 'square') {
                    ctx.fillRect(px - pSize/2, py - pSize/2, pSize, pSize);
                    ctx.strokeRect(px - pSize/2, py - pSize/2, pSize, pSize);
                } else if (pType === 'triangle') {
                    ctx.beginPath();
                    ctx.moveTo(px, py - pSize/2);
                    ctx.lineTo(px - pSize/2, py + pSize/2);
                    ctx.lineTo(px + pSize/2, py + pSize/2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else if (pType === 'diamond') {
                    ctx.beginPath();
                    ctx.moveTo(px, py - pSize/2);
                    ctx.lineTo(px + pSize/2, py);
                    ctx.lineTo(px, py + pSize/2);
                    ctx.lineTo(px - pSize/2, py);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }

            if (passengers.length > 8) {
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`+${passengers.length - 8}`, x + radiusOffset + 10, y - 4);
            }

            // Подпись типа станции
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(station.type, x, y + size/2 + 4);
        }
    }

    drawLine(ctx, points, color, lineWidth = 3, dashed = false) {
        if (points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (dashed) {
            ctx.setLineDash([6, 4]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ======================== ИГРОВОЙ ЦИКЛ ========================
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.hideGameOver();
        this.score = 0;
        this.week = 1;
        this.weekTimer = 0;
        this.lines = [];
        this.trains = [];
        this.colorIndex = 0;
        this.maxLines = 3;
        this.bridgeCount = 0;
        this.cancelDrawing();
        this.stations = [];
        this.initStations();
        this.updateScoreDisplay();
        this.loop();
    }

    loop() {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    togglePause() {
        if (!this.isRunning || this.isGameOver) return;
        this.isPaused = !this.isPaused;
        if (!this.isPaused) {
            this.loop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.hideUpgradeModal();
        this.isPaused = false;
    }

    newGame() {
        this.stop();
        this.hideGameOver();
        this.isGameOver = false;
        this.stations = [];
        this.lines = [];
        this.trains = [];
        this.score = 0;
        this.week = 1;
        this.weekTimer = 0;
        this.maxLines = 3;
        this.bridgeCount = 0;
        this.colorIndex = 0;
        this.cancelDrawing();
        this.initStations();
        this.updateScoreDisplay();
        this.draw();
        this.start();
    }

    // ======================== ПУБЛИЧНЫЙ API ========================
    startGame() { this.start(); }
    pauseGame() { this.togglePause(); }
    resetGame() { this.newGame(); }
}