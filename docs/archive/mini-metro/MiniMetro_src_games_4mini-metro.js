// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 4: Улучшения и ресурсы (недели, выбор бонусов)
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

        // --- Таймер генерации пассажиров ---
        this.passengerTimer = 0;
        this.passengerInterval = 60;

        // --- Рисование линии (взаимодействие с мышью) ---
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
        this.maxLines = 3;              // максимальное количество линий
        this.bridgeCount = 0;           // количество доступных мостов (пока не используется)
        this.week = 1;                 // текущая неделя
        this.weekDuration = 600;       // длительность недели в кадрах (~10 сек при 60fps)
        this.weekTimer = 0;
        this.isWeekEnd = false;        // флаг, что неделя закончилась
        this.pendingUpgrades = null;   // массив из двух улучшений для выбора

        // --- Модальное окно выбора улучшений ---
        this.setupUpgradeModal();

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
                overflowTimer: 0
            });
        }
    }

    // ======================== ПАССАЖИРЫ ========================
    generatePassenger() {
        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
        if (!station) return;
        if (station.passengers.length >= station.capacity) return;

        const types = ['circle', 'square', 'triangle'];
        const available = types.filter(t => t !== station.type);
        const destType = available[Math.floor(Math.random() * available.length)];

        station.passengers.push({ type: destType });
    }

    // ======================== ЛИНИИ И ПОЕЗДА ========================
    createLine(stationsArray) {
        // Проверяем лимит линий
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

        // 3. Обновление недели (только если игра не на паузе и не в режиме выбора)
        if (!this.isPaused && this.isRunning && !this.isWeekEnd) {
            this.weekTimer++;
            if (this.weekTimer >= this.weekDuration) {
                this.weekTimer = 0;
                this.endWeek();
            }
        }

        // 4. Обновление счётчика
        this.updateScoreDisplay();
    }

    /**
     * Завершение недели: генерируем два случайных улучшения и показываем модальное окно.
     * Игра ставится на паузу.
     */
    endWeek() {
        const upgradeTypes = ['line', 'carriage', 'bridge', 'interchange'];
        // Перемешиваем и берём первые два
        const shuffled = upgradeTypes.sort(() => Math.random() - 0.5);
        const options = shuffled.slice(0, 2);

        this.pendingUpgrades = options;
        this.isWeekEnd = true;

        // Ставим игру на паузу
        this.isPaused = true;

        // Показываем модальное окно
        this.showUpgradeModal(options);

        // Увеличиваем номер недели
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
        // Скрываем модальное окно и возобновляем игру
        this.hideUpgradeModal();
        this.isPaused = false;
        this.isWeekEnd = false;
        this.pendingUpgrades = null;
        // Запускаем цикл, если игра запущена
        if (this.isRunning) {
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
        if (!this.isRunning || this.isPaused) return;
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

    onMouseUp(e) {
        
    }

    onDoubleClick(e) {
        if (!this.isRunning || this.isPaused) return;
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
                // Если не удалось создать (превышен лимит), просто сбрасываем
                this.cancelDrawing();
                // Можно показать уведомление
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

    /**
     * Главный метод отрисовки.
     * Последовательность:
     * 1. Фон и сетка.
     * 2. Все линии (постоянные + временная строящаяся).
     * 3. Поезда (как кружки на линии).
     * 4. Станции и пассажиры.
     */
    draw() {
        const ctx = this.ctx;
        const w = this.width, h = this.height;

        // --- ФОН ---
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        // Сетка
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
        // Постоянные линии
        for (const line of this.lines) {
            this.drawLine(ctx, line.stations, line.color, 3);
        }

        // Временная линия (строящаяся)
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

            ctx.fillStyle = '#4fc3f7';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;

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
                }
            }

            if (passengers.length > 8) {
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`+${passengers.length - 8}`, x + radiusOffset + 10, y - 4);
            }

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
        if (!this.isRunning || this.isPaused) return;
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    togglePause() {
        if (!this.isRunning) return;
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