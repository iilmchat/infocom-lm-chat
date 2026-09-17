// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 3: Создание линий, движение поездов, перевозка пассажиров
 */
export class MiniMetroGame {
    // ======================== КОНСТРУКТОР ========================
    constructor(container) {
        this.container = container;

        // --- Холст ---
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // --- Отображение счёта ---
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.style.cssText = 'text-align:center;font-size:16px;margin-top:8px;color:var(--text-primary);';
        this.scoreDisplay.textContent = '🚇 Перевезено: 0';
        this.container.appendChild(this.scoreDisplay);

        // --- Размеры ---
        this.width = 0;
        this.height = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // --- Состояние игры ---
        this.stations = [];          // массив станций
        this.lines = [];            // массив линий
        this.trains = [];           // массив поездов
        this.score = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationId = null;

        // --- Таймер генерации пассажиров ---
        this.passengerTimer = 0;
        this.passengerInterval = 60; // кадров между появлениями

        // --- Рисование линии (взаимодействие с мышью) ---
        this.isDrawing = false;          // идет ли создание линии
        this.currentLineStations = [];   // массив станций в строящейся линии
        this.tempLinePoints = [];        // для отрисовки временной линии (массив {x,y})
        this.currentColor = null;        // цвет текущей линии
        this.colorIndex = 0;             // индекс для выбора следующего цвета
        // Палитра цветов линий (яркие, контрастные)
        this.lineColors = [
            '#ff6b6b', // красный
            '#4ecdc4', // бирюзовый
            '#ffe66d', // жёлтый
            '#a29bfe', // фиолетовый
            '#fd79a8', // розовый
            '#fdcb6e', // оранжевый
            '#00b894', // зелёный
            '#74b9ff'  // голубой
        ];

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
                passengers: [], // массив { type: string }
                shape: types[i % types.length],
                overflowTimer: 0 // для будущей механики
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

    /**
     * Создаёт новую линию из переданного массива станций.
     * Присваивает ей цвет, создаёт поезд и добавляет в списки.
     */
    createLine(stationsArray) {
        if (stationsArray.length < 2) return null;

        const color = this.lineColors[this.colorIndex % this.lineColors.length];
        this.colorIndex++;

        const line = {
            stations: stationsArray.slice(), // копия массива
            color: color,
            train: null // будет создан ниже
        };

        // Создаём поезд на этой линии
        const train = {
            line: line,
            currentStationIndex: 0,        // индекс станции, к которой движется
            progress: 0,                   // от 0 до 1 (доля пути между станциями)
            direction: 1,                  // 1 — вперёд, -1 — назад
            passengers: [],               // пассажиры в поезде (массив { type: string })
            capacity: 6                   // начальная вместимость (можно увеличивать)
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
        const speed = 0.005; // скорость движения между станциями (чем больше, тем быстрее)

        for (const train of this.trains) {
            const line = train.line;
            const stations = line.stations;
            if (stations.length < 2) continue;

            // Увеличиваем прогресс
            train.progress += speed * train.direction;

            // Если достигли или превысили 1 (прибыли на следующую станцию)
            if (train.progress >= 1) {
                // Переходим к следующей станции
                train.progress = 0;
                let nextIndex = train.currentStationIndex + train.direction;

                // Проверяем, не вышли ли за пределы
                if (nextIndex < 0 || nextIndex >= stations.length) {
                    // Меняем направление
                    train.direction *= -1;
                    nextIndex = train.currentStationIndex + train.direction;
                    // Если всё равно за пределами (линия из одной станции?) — защита
                    if (nextIndex < 0 || nextIndex >= stations.length) continue;
                }

                // Обновляем индекс текущей станции
                train.currentStationIndex = nextIndex;
                const currentStation = stations[train.currentStationIndex];

                // ----- ВЫСАДКА пассажиров -----
                const toRemove = [];
                for (let i = 0; i < train.passengers.length; i++) {
                    if (train.passengers[i].type === currentStation.type) {
                        toRemove.push(i);
                        this.score++; // увеличиваем счёт за перевезённого пассажира
                    }
                }
                // Удаляем высаженных (в обратном порядке)
                for (let i = toRemove.length - 1; i >= 0; i--) {
                    train.passengers.splice(toRemove[i], 1);
                }

                // ----- ПОСАДКА пассажиров со станции -----
                // Определяем, какие типы станций есть впереди по маршруту (в направлении движения)
                const futureTypes = new Set();
                let idx = train.currentStationIndex + train.direction;
                while (idx >= 0 && idx < stations.length) {
                    futureTypes.add(stations[idx].type);
                    idx += train.direction;
                }

                // Пассажиры на текущей станции
                const stationPassengers = currentStation.passengers;
                const toBoard = [];
                for (let i = 0; i < stationPassengers.length; i++) {
                    const p = stationPassengers[i];
                    // Если тип пассажира есть в будущих станциях, и в поезде есть место
                    if (futureTypes.has(p.type) && train.passengers.length < train.capacity) {
                        toBoard.push(i);
                    }
                }
                // Забираем пассажиров (в обратном порядке)
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

        // 3. Обновление счётчика на экране
        this.updateScoreDisplay();
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

            // Вычисляем текущую позицию поезда
            const idx = train.currentStationIndex;
            const nextIdx = idx + train.direction;
            if (nextIdx < 0 || nextIdx >= stations.length) continue; // защита

            const from = stations[idx];
            const to = stations[nextIdx];
            const t = train.progress; // 0..1

            const px = from.x + (to.x - from.x) * t;
            const py = from.y + (to.y - from.y) * t;

            // Рисуем поезд как круг с цветом линии
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = line.color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Небольшой индикатор загруженности (количество пассажиров)
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

            // Станция
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

            // Если пассажиров больше 8, показываем "+N"
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

    /**
     * Вспомогательная функция для рисования линии по точкам.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} points - массив объектов {x, y} или станций
     * @param {string} color
     * @param {number} lineWidth
     * @param {boolean} dashed - рисовать пунктиром (для временной линии)
     */
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

    // ======================== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ========================
    updateScoreDisplay() {
        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = `🚇 Перевезено: ${this.score}`;
        }
    }

    // ======================== ОБРАБОТКА МЫШИ (СОЗДАНИЕ ЛИНИЙ) ========================

    setupMouseEvents() {
        // Привязываем контекст, чтобы использовать this в обработчиках
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
    }

    /**
     * Определяет, находится ли точка (x,y) внутри станции.
     * Возвращает индекс станции или -1.
     */
    getStationAt(x, y) {
        const radius = 20; // размер станции
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
        if (!this.isRunning) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const stationIndex = this.getStationAt(mouseX, mouseY);

        if (stationIndex !== -1) {
            // Клик по станции
            const station = this.stations[stationIndex];

            // Если не начата линия — начинаем новую
            if (!this.isDrawing) {
                this.isDrawing = true;
                this.currentLineStations = [station];
                this.tempLinePoints = [{ x: station.x, y: station.y }];
                this.currentColor = this.lineColors[this.colorIndex % this.lineColors.length];
                // Увеличиваем цветовой индекс только при создании новой линии (позже)
            } else {
                // Если линия уже строится
                const lastStation = this.currentLineStations[this.currentLineStations.length - 1];
                // Не добавляем ту же станцию повторно
                if (lastStation === station) return;
                // Проверяем, не была ли эта станция уже добавлена (запрещаем повторное посещение)
                if (this.currentLineStations.some(s => s === station)) {
                    // Можно завершить линию, если это двойной клик или клик по первой станции?
                    // Для простоты просто игнорируем.
                    return;
                }
                // Добавляем станцию в линию
                this.currentLineStations.push(station);
                this.tempLinePoints.push({ x: station.x, y: station.y });
            }
        } else {
            // Клик по пустому месту — завершаем линию, если она есть
            if (this.isDrawing && this.currentLineStations.length >= 2) {
                this.finishLine();
            } else {
                // Если линия не начата или слишком короткая — сброс
                this.cancelDrawing();
            }
        }
        this.draw();
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;
        // Обновляем временную линию для отображения хвоста (привязка к курсору)
        // Но в Mini Metro обычно линия фиксируется только на станциях, поэтому не нужно
        // Однако можно добавить отображение от последней станции до курсора
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Если есть хотя бы одна станция, обновляем последнюю точку временной линии
        if (this.tempLinePoints.length > 0) {
            // Удаляем последнюю точку (которая была от предыдущего движения) и добавляем новую
            // Но для простоты просто пересоздаём массив из currentLineStations + текущий курсор
            this.tempLinePoints = this.currentLineStations.map(s => ({ x: s.x, y: s.y }));
            this.tempLinePoints.push({ x: mouseX, y: mouseY });
            this.draw();
        }
    }

    onMouseUp(e) {
        // Ничего не делаем, завершение только по клику на пустом месте или двойному клику
    }

    onDoubleClick(e) {
        // Двойной клик — завершаем линию, если она есть
        if (this.isDrawing && this.currentLineStations.length >= 2) {
            this.finishLine();
        } else {
            this.cancelDrawing();
        }
        this.draw();
    }

    /**
     * Завершает создание линии: создаёт линию и поезд, сбрасывает состояние рисования.
     */
    finishLine() {
        if (this.currentLineStations.length >= 2) {
            // Запоминаем цвет до увеличения индекса
            const color = this.currentColor;
            // Создаём линию
            const line = this.createLine(this.currentLineStations);
            if (line) {
                // Увеличиваем счётчик цвета (уже сделано внутри createLine)
                // Очищаем временные данные
                this.isDrawing = false;
                this.currentLineStations = [];
                this.tempLinePoints = [];
                this.currentColor = null;
                // Перерисовываем
                this.draw();
            }
        } else {
            this.cancelDrawing();
        }
    }

    /**
     * Отменяет текущее рисование.
     */
    cancelDrawing() {
        this.isDrawing = false;
        this.currentLineStations = [];
        this.tempLinePoints = [];
        this.currentColor = null;
        this.draw();
    }

    // ======================== ИГРОВОЙ ЦИКЛ ========================

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.updateScoreDisplay();
        // Сбрасываем линии и поезда (на случай перезапуска)
        this.lines = [];
        this.trains = [];
        this.colorIndex = 0;
        this.cancelDrawing();
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
    }

    newGame() {
        this.stop();
        // Сброс состояния
        this.stations = [];
        this.lines = [];
        this.trains = [];
        this.score = 0;
        this.passengerTimer = 0;
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