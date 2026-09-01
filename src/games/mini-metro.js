// src/games/mini-metro.js
/**
 * Игра Mini Metro (упрощённая версия)
 * Добавлено в 6.1
 * 
 * Изменения в 6.1:
 * - Станции генерируются каждые 30 секунд (было 10)
 * - Пассажиры генерируются каждые 20 секунд (было 3)
 * - У станций отображаются порядковые номера
 * - У пассажиров на станции отображается номер станции назначения
 */

export class MiniMetroGame {
    /**
     * @param {HTMLElement} container - контейнер для игры
     */
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 600;
        this.canvas.height = 500;
        this.ctx = this.canvas.getContext('2d');

        // Состояние игры
        this.stations = [];
        this.lines = [];
        this.passengers = [];
        this.score = 0;
        this.gameOver = false;
        this.paused = false;
        this.started = false;

        // Параметры
        this.capacity = 10;
        this.stationRadius = 16;
        this.passengerRadius = 4;
        this.lineWidth = 4;

        // Генерация (изменено в 6.1)
        this.stationGenInterval = null;
        this.passengerGenInterval = null;
        this.stationGenTimer = 0;
        this.passengerGenTimer = 0;
        this.stationGenDelay = 30000; // 30 секунд (было 10000)
        this.passengerGenDelay = 10000; // 20 секунд (было 3000)

        // Текущая линия (строящаяся)
        this.currentLine = null; // { stations: [], color: '' }
        this.isBuildingLine = false;

        // Список цветов для станций и линий
        this.colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
            '#e67e22', '#1abc9c', '#e84393', '#00b894', '#fdcb6e'
        ];
        this.colorIndex = 0;

        // Счётчик станций для нумерации (добавлено в 6.1)
        this.stationCounter = 0;

        // Управление
        this.setupUI();
        this.setupEventListeners();

        // Анимация
        this.lastTimestamp = 0;
        this.animationId = null;
    }

    // ---- UI Elements ----
    setupUI() {
        // Очищаем контейнер
        this.container.innerHTML = '';

        // Информационная панель
        this.infoDiv = document.createElement('div');
        this.infoDiv.className = 'game-info';
        this.infoDiv.innerHTML = `
            <span class="game-score">🏆 Счёт: <span id="metroScore">0</span></span>
            <span class="game-status" id="metroStatus">⏸ Пауза</span>
            <span class="game-stations">🚉 Станций: <span id="metroStationCount">0</span></span>
        `;
        this.container.appendChild(this.infoDiv);

        // Управление
        this.controlsDiv = document.createElement('div');
        this.controlsDiv.className = 'game-controls';
        this.controlsDiv.innerHTML = `
            <button class="btn-start" id="metroStartBtn">▶ Старт</button>
            <button class="btn-pause" id="metroPauseBtn">⏸ Пауза</button>
            <button class="btn-new" id="metroNewBtn">🔄 Новая</button>
            <button class="btn-finish" id="metroFinishBtn">✅ Завершить линию</button>
            <button class="btn-delete" id="metroDeleteBtn">🗑 Удалить линию (Shift+клик)</button>
        `;
        this.container.appendChild(this.controlsDiv);

        // Canvas
        this.container.appendChild(this.canvas);

        // Подсказка
        const hint = document.createElement('div');
        hint.className = 'metro-hint';
        hint.textContent = '💡 Клик по станции — добавить в линию. Правая кнопка мыши или "Завершить линию" — закончить линию. Shift+клик по станции — удалить линию.';
        this.container.appendChild(hint);

        // Сохраняем ссылки на элементы
        this.scoreEl = document.getElementById('metroScore');
        this.statusEl = document.getElementById('metroStatus');
        this.stationCountEl = document.getElementById('metroStationCount');
    }

    setupEventListeners() {
        // Кнопки
        this.container.querySelector('#metroStartBtn').addEventListener('click', () => this.start());
        this.container.querySelector('#metroPauseBtn').addEventListener('click', () => this.togglePause());
        this.container.querySelector('#metroNewBtn').addEventListener('click', () => this.newGame());
        this.container.querySelector('#metroFinishBtn').addEventListener('click', () => this.finishCurrentLine());

        // Обработка кликов на canvas
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.finishCurrentLine();
        });

        // Клавиатура
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isBuildingLine) {
                this.cancelCurrentLine();
            }
        });
    }

    // ---- Управление игрой ----
    start() {
        if (this.started) return;
        this.started = true;
        this.paused = false;
        this.gameOver = false;
        this.statusEl.textContent = '▶ Игра';
        // Генерируем начальные станции
        for (let i = 0; i < 6; i++) {
            this.addStation();
        }
        // Запускаем генерацию (интервалы с новыми задержками)
        this.stationGenInterval = setInterval(() => this.addStation(), this.stationGenDelay);
        this.passengerGenInterval = setInterval(() => this.generatePassenger(), this.passengerGenDelay);
        // Запускаем анимацию
        this.lastTimestamp = performance.now();
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    togglePause() {
        if (!this.started || this.gameOver) return;
        this.paused = !this.paused;
        this.statusEl.textContent = this.paused ? '⏸ Пауза' : '▶ Игра';
        if (!this.paused) {
            this.lastTimestamp = performance.now();
        }
    }

    newGame() {
        // Останавливаем всё
        this.stop();
        // Сбрасываем состояние
        this.stations = [];
        this.lines = [];
        this.passengers = [];
        this.score = 0;
        this.gameOver = false;
        this.paused = false;
        this.started = false;
        this.currentLine = null;
        this.isBuildingLine = false;
        this.colorIndex = 0;
        this.stationCounter = 0; // сброс счётчика
        this.updateUI();
        // Очищаем канвас
        this.render();
        this.statusEl.textContent = '⏸ Пауза';
        this.scoreEl.textContent = '0';
        this.stationCountEl.textContent = '0';
    }

    stop() {
        if (this.stationGenInterval) {
            clearInterval(this.stationGenInterval);
            this.stationGenInterval = null;
        }
        if (this.passengerGenInterval) {
            clearInterval(this.passengerGenInterval);
            this.passengerGenInterval = null;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.started = false;
    }

    // ---- Генерация ----
    addStation() {
        if (this.gameOver) return;
        // Попытка найти свободное место
        let attempts = 50;
        let x, y, ok;
        do {
            x = this.stationRadius + Math.random() * (this.canvas.width - 2 * this.stationRadius);
            y = this.stationRadius + Math.random() * (this.canvas.height - 2 * this.stationRadius);
            ok = true;
            for (const s of this.stations) {
                const dx = s.x - x;
                const dy = s.y - y;
                if (Math.sqrt(dx*dx + dy*dy) < 50) {
                    ok = false;
                    break;
                }
            }
            attempts--;
        } while (!ok && attempts > 0);
        if (!ok) return;

        const color = this.colors[this.colorIndex % this.colors.length];
        this.colorIndex++;
        // Увеличиваем счётчик и присваиваем номер станции (добавлено в 6.1)
        this.stationCounter++;
        const station = {
            id: Date.now() + Math.random(),
            x, y,
            color: color,
            passengers: [],
            capacity: this.capacity,
            number: this.stationCounter // номер станции (порядковый)
        };
        this.stations.push(station);
        this.updateUI();
        this.render();
    }

    generatePassenger() {
        if (this.gameOver || this.stations.length < 2) return;
        // Выбираем случайную станцию отправления с пассажирами < capacity
        const candidates = this.stations.filter(s => s.passengers.length < s.capacity);
        if (candidates.length === 0) return;
        const origin = candidates[Math.floor(Math.random() * candidates.length)];
        // Целевая станция (отличная от origin)
        let target;
        do {
            target = this.stations[Math.floor(Math.random() * this.stations.length)];
        } while (target.id === origin.id);
        // Создаём пассажира
        const passenger = {
            id: Date.now() + Math.random(),
            originId: origin.id,
            targetId: target.id,
            targetNumber: target.number, // запоминаем номер целевой станции (добавлено в 6.1)
            currentStationId: origin.id,
            progress: 0, // 0..1 между станциями
            route: [], // массив id станций, включая начальную и конечную (если найден)
            lineId: null, // id линии, по которой движется
            status: 'waiting' // waiting, traveling, delivered
        };
        // Пытаемся найти маршрут (если есть линия, содержащая обе станции)
        const route = this.findRoute(origin.id, target.id);
        if (route) {
            passenger.route = route;
            passenger.status = 'traveling';
            // Перемещаем на первую станцию маршрута (origin уже там)
            passenger.currentStationId = route[0];
            passenger.progress = 0;
            // Назначаем линию (первая линия, соединяющая первые две станции)
            const line = this.findLineBetween(route[0], route[1]);
            if (line) {
                passenger.lineId = line.id;
            } else {
                // Если линии нет, остаётся ждать
                passenger.status = 'waiting';
                passenger.route = [];
            }
        } else {
            // Нет маршрута, остаётся ждать
            passenger.route = [];
            passenger.status = 'waiting';
        }
        // Добавляем пассажира на станцию
        origin.passengers.push(passenger);
        this.passengers.push(passenger);
        // Проверяем переполнение
        this.checkOverflow(origin);
        this.updateUI();
        this.render();
    }

    // ---- Поиск маршрута (упрощённый) ----
    findRoute(fromId, toId) {
        // Ищем линию, которая содержит обе станции
        for (const line of this.lines) {
            const ids = line.stations.map(s => s.id);
            const idxFrom = ids.indexOf(fromId);
            const idxTo = ids.indexOf(toId);
            if (idxFrom !== -1 && idxTo !== -1) {
                // Возвращаем маршрут по линии от from до to (включая обе)
                const route = [];
                if (idxFrom < idxTo) {
                    for (let i = idxFrom; i <= idxTo; i++) {
                        route.push(line.stations[i].id);
                    }
                } else {
                    for (let i = idxFrom; i >= idxTo; i--) {
                        route.push(line.stations[i].id);
                    }
                }
                return route;
            }
        }
        return null;
    }

    findLineBetween(id1, id2) {
        for (const line of this.lines) {
            const ids = line.stations.map(s => s.id);
            if (ids.includes(id1) && ids.includes(id2)) {
                return line;
            }
        }
        return null;
    }

    // ---- Линии ----
    startNewLine() {
        if (this.isBuildingLine) return;
        this.currentLine = {
            stations: [],
            color: this.colors[this.colorIndex % this.colors.length],
            id: Date.now() + Math.random()
        };
        this.colorIndex++;
        this.isBuildingLine = true;
        this.statusEl.textContent = '✏️ Строим линию';
    }

    addStationToLine(station) {
        if (!this.isBuildingLine) {
            this.startNewLine();
        }
        // Проверяем, что станция уже не добавлена
        if (this.currentLine.stations.some(s => s.id === station.id)) {
            // Если это последняя станция, завершаем линию
            if (this.currentLine.stations[this.currentLine.stations.length - 1]?.id === station.id) {
                this.finishCurrentLine();
            }
            return;
        }
        this.currentLine.stations.push(station);
        this.render();
    }

    finishCurrentLine() {
        if (!this.isBuildingLine || this.currentLine.stations.length < 2) {
            if (this.isBuildingLine) {
                // Если меньше 2 станций, отменяем
                this.cancelCurrentLine();
            }
            return;
        }
        // Сохраняем линию
        const line = {
            id: this.currentLine.id,
            stations: [...this.currentLine.stations],
            color: this.currentLine.color
        };
        this.lines.push(line);
        // Очищаем текущую
        this.currentLine = null;
        this.isBuildingLine = false;
        this.statusEl.textContent = '▶ Игра';
        // После добавления линии, пытаемся отправить ожидающих пассажиров
        this.tryDispatchWaitingPassengers();
        this.render();
        this.updateUI();
    }

    cancelCurrentLine() {
        this.currentLine = null;
        this.isBuildingLine = false;
        this.statusEl.textContent = this.paused ? '⏸ Пауза' : '▶ Игра';
        this.render();
    }

    deleteLine(lineId) {
        this.lines = this.lines.filter(l => l.id !== lineId);
        // Пассажиры, которые были на этой линии, становятся ожидающими
        for (const p of this.passengers) {
            if (p.lineId === lineId) {
                p.lineId = null;
                p.status = 'waiting';
                p.route = [];
                // Возвращаем на текущую станцию
                p.currentStationId = p.originId;
                p.progress = 0;
                // Добавляем на станцию
                const station = this.stations.find(s => s.id === p.originId);
                if (station && !station.passengers.includes(p)) {
                    station.passengers.push(p);
                }
            }
        }
        this.render();
        this.updateUI();
    }

    // ---- Движение пассажиров ----
    tryDispatchWaitingPassengers() {
        // Для всех ожидающих пассажиров пытаемся найти маршрут
        for (const p of this.passengers) {
            if (p.status === 'waiting') {
                const route = this.findRoute(p.originId, p.targetId);
                if (route) {
                    p.route = route;
                    p.status = 'traveling';
                    p.currentStationId = route[0];
                    p.progress = 0;
                    const line = this.findLineBetween(route[0], route[1]);
                    if (line) {
                        p.lineId = line.id;
                    } else {
                        // Если линии нет, остаётся ждать
                        p.status = 'waiting';
                        p.route = [];
                    }
                }
            }
        }
    }

    updatePassengers(deltaTime) {
        if (this.paused || this.gameOver) return;
        const speed = 0.5; // станций в секунду
        const step = speed * deltaTime;

        for (const p of this.passengers) {
            if (p.status !== 'traveling') continue;
            p.progress += step;
            if (p.progress >= 1) {
                // Достигли следующей станции
                p.progress = 0;
                // Перемещаем на следующую станцию в маршруте
                const currentIdx = p.route.indexOf(p.currentStationId);
                if (currentIdx === -1) {
                    p.status = 'waiting';
                    continue;
                }
                const nextIdx = currentIdx + 1;
                if (nextIdx >= p.route.length) {
                    // Конечная станция
                    p.status = 'delivered';
                    this.score++;
                    // Удаляем пассажира со станции
                    const station = this.stations.find(s => s.id === p.currentStationId);
                    if (station) {
                        const idx = station.passengers.indexOf(p);
                        if (idx !== -1) station.passengers.splice(idx, 1);
                    }
                    // Удаляем из общего массива? Можно оставить, но помечать delivered.
                    // Мы оставим, но при рендере не будем рисовать.
                    continue;
                }
                // Следующая станция
                const nextStationId = p.route[nextIdx];
                p.currentStationId = nextStationId;
                // Проверяем, есть ли линия между текущей и следующей
                const line = this.findLineBetween(p.currentStationId, nextStationId);
                if (line) {
                    p.lineId = line.id;
                } else {
                    // Если линии нет, пассажир не может двигаться
                    p.status = 'waiting';
                    p.route = [];
                    // Возвращаем на предыдущую станцию (текущую)
                    // Он уже на ней, так что просто добавляем его в очередь этой станции
                    const station = this.stations.find(s => s.id === p.currentStationId);
                    if (station && !station.passengers.includes(p)) {
                        station.passengers.push(p);
                    }
                }
            }
        }

        // Удаляем доставленных пассажиров из общего списка (чтобы не накапливались)
        this.passengers = this.passengers.filter(p => p.status !== 'delivered');
        // Также удаляем их со станций (уже удалены выше)
        this.updateUI();
        this.checkGameOver();
    }

    // ---- Проверка переполнения ----
    checkOverflow(station) {
        if (station.passengers.length > station.capacity) {
            this.gameOver = true;
            this.statusEl.textContent = '💀 Игра окончена!';
            this.stop();
            this.render();
            alert('Игра окончена! Станция переполнена.');
        }
    }

    checkGameOver() {
        for (const s of this.stations) {
            if (s.passengers.length > s.capacity) {
                this.gameOver = true;
                this.statusEl.textContent = '💀 Игра окончена!';
                this.stop();
                this.render();
                alert('Игра окончена! Станция переполнена.');
                break;
            }
        }
    }

    // ---- Обработка кликов ----
    handleCanvasClick(e) {
        if (this.gameOver || !this.started) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Проверяем, не кликнули ли по станции
        for (const station of this.stations) {
            const dx = station.x - mouseX;
            const dy = station.y - mouseY;
            if (Math.sqrt(dx*dx + dy*dy) < this.stationRadius + 5) {
                // Если зажат Shift — удаляем линию, содержащую эту станцию
                if (e.shiftKey) {
                    const lineToDelete = this.lines.find(l => l.stations.some(s => s.id === station.id));
                    if (lineToDelete) {
                        this.deleteLine(lineToDelete.id);
                        return;
                    }
                }
                // Иначе добавляем в текущую линию
                this.addStationToLine(station);
                return;
            }
        }
        // Клик по пустому месту — завершаем линию (если она строится)
        if (this.isBuildingLine) {
            this.finishCurrentLine();
        }
    }

    // ---- Рендеринг (обновлен для отображения номеров) ----
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем линии
        for (const line of this.lines) {
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = this.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const stations = line.stations;
            if (stations.length > 0) {
                ctx.moveTo(stations[0].x, stations[0].y);
                for (let i = 1; i < stations.length; i++) {
                    ctx.lineTo(stations[i].x, stations[i].y);
                }
                ctx.stroke();
            }
        }

        // Рисуем текущую линию (строящуюся)
        if (this.isBuildingLine && this.currentLine) {
            ctx.beginPath();
            ctx.strokeStyle = this.currentLine.color;
            ctx.lineWidth = this.lineWidth;
            ctx.setLineDash([5, 5]);
            const stations = this.currentLine.stations;
            if (stations.length > 0) {
                ctx.moveTo(stations[0].x, stations[0].y);
                for (let i = 1; i < stations.length; i++) {
                    ctx.lineTo(stations[i].x, stations[i].y);
                }
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }

        // Рисуем станции с номерами (изменено в 6.1)
        for (const station of this.stations) {
            const radius = this.stationRadius;
            // Круг станции
            ctx.beginPath();
            ctx.arc(station.x, station.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = station.color;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Количество пассажиров
            // Номер станции (белый, крупный) (добавлено в 6.1)
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(station.number, station.x, station.y);      

            /*
            if (station.passengers.length > 0) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(station.passengers.length, station.x, station.y);
            }
            */

            // Пассажиры на станции (маленькие кружки) с номерами целей (изменено в 6.1)
            const count = station.passengers.length;
            const maxDisplay = Math.min(count, 8);
            for (let i = 0; i < maxDisplay; i++) {
                const angle = (i / maxDisplay) * 2 * Math.PI;
                const dist = radius + 8 + 4 * i;
                const px = station.x + Math.cos(angle) * dist;
                const py = station.y + Math.sin(angle) * dist;

                // Кружок пассажира
                ctx.beginPath();
                ctx.arc(px, py, this.passengerRadius, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffd700';
                ctx.fill();

                // Номер целевой станции (маленький текст рядом) (добавлено в 6.1)
                const passenger = station.passengers[i];
                if (passenger && passenger.status === 'waiting') {
                    ctx.fillStyle = '#fff';
                    ctx.font = '8px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    // Рисуем номер над кружком или справа
                    ctx.fillText(passenger.targetNumber, px, py - this.passengerRadius - 2);
                }
            }
        }

        // Рисуем пассажиров в пути
        for (const p of this.passengers) {
            if (p.status !== 'traveling') continue;
            // Определяем текущую позицию между станциями
            const route = p.route;
            const idx = route.indexOf(p.currentStationId);
            if (idx === -1 || idx + 1 >= route.length) continue;
            const fromId = route[idx];
            const toId = route[idx + 1];
            const fromStation = this.stations.find(s => s.id === fromId);
            const toStation = this.stations.find(s => s.id === toId);
            if (!fromStation || !toStation) continue;
            const x = fromStation.x + (toStation.x - fromStation.x) * p.progress;
            const y = fromStation.y + (toStation.y - fromStation.y) * p.progress;

            ctx.beginPath();
            ctx.arc(x, y, this.passengerRadius + 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff6b6b';
            ctx.shadowColor = 'rgba(255,107,107,0.5)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Можно также показывать номер цели у движущихся пассажиров (опционально)
            //начало
             ctx.fillStyle = '#fff';
             ctx.font = '7px Arial';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'bottom';
             ctx.fillText(p.targetNumber, x, y - this.passengerRadius - 4);
             //окончание
        }

        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Игра окончена', this.canvas.width/2, this.canvas.height/2 - 20);
            ctx.font = '20px Arial';
            ctx.fillText(`Счёт: ${this.score}`, this.canvas.width/2, this.canvas.height/2 + 30);
        }
    }

    // ---- Обновление UI ----
    updateUI() {
        this.scoreEl.textContent = this.score;
        this.stationCountEl.textContent = this.stations.length;
    }

    // ---- Игровой цикл ----
    gameLoop(timestamp) {
        if (this.gameOver) {
            this.render();
            return;
        }
        const delta = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;
        if (!this.paused) {
            this.updatePassengers(delta);
            // Проверяем, не нужно ли сгенерировать станции (альтернативно через setInterval, но мы используем интервалы)
            // интервалы уже есть
        }
        this.render();
        this.animationId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    // ---- Уничтожение ----
    destroy() {
        this.stop();
        // Удаляем слушатели, если нужно
    }
}