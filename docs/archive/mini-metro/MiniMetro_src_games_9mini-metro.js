// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 1–8: полная реализация
 * 
 * Исправлено в спринте 8 (корректировка):
 * - Размер карты фиксирован (800x600) с масштабированием под контейнер
 * - Уменьшена частота появления новых станций (раз в 2 недели)
 * - Все координаты станций генерируются в пределах карты
 * - Добавлена адаптивная подгонка canvas под размеры контейнера
 */
export class MiniMetroGame {
    // ======================== КОНСТРУКТОР ========================
    constructor(container) {
        this.container = container;

        // --- Размеры карты (фиксированные) ---
        this.MAP_WIDTH = 800;
        this.MAP_HEIGHT = 600;

        // --- Холст ---
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // --- Отображение счёта и недели ---
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.style.cssText = 'text-align:center;font-size:16px;margin-top:8px;color:var(--text-primary);';
        this.scoreDisplay.textContent = '🚇 Перевезено: 0 | Неделя: 1';
        this.container.appendChild(this.scoreDisplay);

        // --- Инициализация размеров и масштабирования ---
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
        this.isGameOver = false;
        this.mode = null;

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
        this.weekDuration = 600;
        this.weekTimer = 0;
        this.isWeekEnd = false;
        this.pendingUpgrades = null;

        // --- Анимации ---
        this.animations = [];

        // --- Звуки ---
        this.audioCtx = null;
        this.soundsEnabled = true;

        // --- Сохранение ---
        this.saveKey = 'miniMetroSave';
        this.autoSaveInterval = null;

        // --- Исправлено: счётчик недель без новой станции ---
        this.weeksWithoutStation = 0;

        // --- Модальные окна ---
        this.setupUpgradeModal();
        this.setupGameOverOverlay();
        this.setupModeSelectionOverlay();

        // --- Инициализация ---
        this.initStations();
        this.setupMouseEvents();
        this.setupKeyboardEvents();

        // --- Загрузка сохранения ---
        this.loadGame();

        this.draw();
    }

    // ======================== РАЗМЕРЫ И МАСШТАБИРОВАНИЕ ========================
    resize() {
        const rect = this.container.getBoundingClientRect();
        const padding = 20;
        // Доступная ширина и высота для карты
        let availW = rect.width - padding * 2;
        let availH = rect.height - padding * 2;

        // Вычисляем масштаб, чтобы карта вписалась в доступное пространство
        const scaleX = availW / this.MAP_WIDTH;
        const scaleY = availH / this.MAP_HEIGHT;
        const scale = Math.min(scaleX, /*scaleY,*/ 1); // не более 1 (без увеличения)

        // Устанавливаем размеры canvas в пикселях карты
        this.canvas.width = this.MAP_WIDTH;
        this.canvas.height = this.MAP_HEIGHT;
        // Масштабируем через CSS
        const displayWidth = this.MAP_WIDTH * scale;
        const displayHeight = this.MAP_HEIGHT * scale;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        this.canvas.style.margin = '0 auto';
        this.canvas.style.display = 'block';

        // Сохраняем масштаб для преобразования координат мыши
        this.scale = scale;
        // Сохраняем смещение для центрирования (если нужно)
        this.offsetX = (availW - displayWidth) / 2 + padding;
        this.offsetY = (availH - displayHeight) / 2 + padding;
        // Применяем к canvas через CSS
        this.canvas.style.marginLeft = this.offsetX + 'px';
        this.canvas.style.marginTop = this.offsetY + 'px';
    }

    // ======================== СТАНЦИИ ========================
    initStations() {
        const types = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon'];
        const count = 3;
        const cx = this.MAP_WIDTH / 2;
        const cy = this.MAP_HEIGHT / 2;
        const radius = 80; // больше радиус для карты 800x600

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
                overflowTimer: 0,
                appearProgress: 1,
                targetAppear: 1
            });
        }
    }

    // ======================== ГЕНЕРАЦИЯ НОВЫХ СТАНЦИЙ ========================
    addNewStation() {
        const types = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon'];
        const type = types[Math.floor(Math.random() * types.length)];
        const padding = 40;
        // увеличено для карты 800x600
        const minDist = 120; 

        let attempts = 80;
        let x, y, ok;

        while (attempts-- > 0) {
            x = padding + Math.random() * (this.MAP_WIDTH - 2 * padding);
            y = padding + Math.random() * (this.MAP_HEIGHT - 2 * padding);
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
            overflowTimer: 0,
            appearProgress: 0,
            targetAppear: 1
        };
        this.stations.push(newStation);

        this.animations.push({
            type: 'stationAppear',
            station: newStation,
            progress: 0,
            duration: 30
        });

        this.playSound('stationAppear');
        return true;
    }

    // ======================== ПАССАЖИРЫ ========================
    generatePassenger() {
        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
        if (!station) return;
        if (station.passengers.length >= station.capacity) return;

        const allTypes = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon'];
        const available = allTypes.filter(t => t !== station.type);
        const destType = available[Math.floor(Math.random() * available.length)];

        station.passengers.push({ type: destType });
    }

    // ======================== ЛИНИИ И ПОЕЗДА ========================
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

                // ----- ВЫСАДКА пассажиров (с анимацией) -----
                const toRemove = [];
                for (let i = 0; i < train.passengers.length; i++) {
                    if (train.passengers[i].type === currentStation.type) {
                        toRemove.push(i);
                        this.score++;
                        this.animations.push({
                            type: 'passengerDisembark',
                            from: { x: train.x, y: train.y },
                            to: { x: currentStation.x, y: currentStation.y },
                            progress: 0,
                            duration: 20
                        });
                        this.playSound('disembark');
                    }
                }
                for (let i = toRemove.length - 1; i >= 0; i--) {
                    train.passengers.splice(toRemove[i], 1);
                }

                // ----- ПОСАДКА пассажиров со станции  (с анимацией) -----
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
                    this.animations.push({
                        type: 'passengerBoard',
                        from: { x: currentStation.x, y: currentStation.y },
                        to: { x: train.x, y: train.y },
                        progress: 0,
                        duration: 20
                    });
                    this.playSound('board');
                }
            }
        }
    }

    // ======================== ОБНОВЛЕНИЕ ИГРЫ ========================
    update() {
        // Генерация пассажиров
        this.passengerTimer++;
        if (this.passengerTimer >= this.passengerInterval) {
            this.passengerTimer = 0;
            const count = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this.generatePassenger();
            }
        }

        // Движение поездов
        this.updateTrains();

        // Обновление недели
        if (!this.isPaused && this.isRunning && !this.isWeekEnd && !this.isGameOver) {
            this.weekTimer++;
            if (this.weekTimer >= this.weekDuration) {
                this.weekTimer = 0;
                this.endWeek();
            }
        }

        // Проверка переполнения
        if (!this.isGameOver && this.isRunning && this.mode !== 'endless') {
            const overflowThreshold = 10 * 60;
            for (const station of this.stations) {
                if (station.passengers.length > station.capacity) {
                    station.overflowTimer += 1;
                    if (station.overflowTimer >= overflowThreshold) {
                        this.gameOver();
                        return;
                    }
                } else {
                    station.overflowTimer = 0;
                }
            }
        }

        // Анимации
        this.updateAnimations();

        // Обновление счётчика
        this.updateScoreDisplay();
    }

    // ======================== АНИМАЦИИ ========================
    updateAnimations() {
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            anim.progress += 1 / anim.duration;
            if (anim.progress >= 1) {
                anim.progress = 1;
                if (anim.type === 'stationAppear') {
                    anim.station.appearProgress = 1;
                }
                this.animations.splice(i, 1);
            } else {
                if (anim.type === 'stationAppear') {
                    anim.station.appearProgress = anim.progress;
                }
            }
        }
    }

    // ======================== ЗАВЕРШЕНИЕ НЕДЕЛИ ========================
    endWeek() {
        // Исправлено: добавляем станцию не каждую неделю, а раз в 2 недели (вероятность 50%)
        this.weeksWithoutStation++;
        if (this.weeksWithoutStation >= 2) {
            this.weeksWithoutStation = 0;
            this.addNewStation();
        } else {
            // Можно добавить с вероятностью 50% (дополнительно)
            if (Math.random() < 0.3) { // 30% шанс добавить раньше
                this.addNewStation();
                this.weeksWithoutStation = 0;
            }
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

        // Сохранение
        this.saveGame();
    }

    // ======================== УЛУЧШЕНИЯ ========================
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
        this.saveGame();
    }

    // ======================== ЗВУКИ ========================
    initAudio() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                this.soundsEnabled = false;
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playSound(type) {
        if (!this.soundsEnabled) return;
        this.initAudio();
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        switch (type) {
            case 'board':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.1);
                break;
            case 'disembark':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.1);
                break;
            case 'stationAppear':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.15);
                break;
            case 'gameOver':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.5);
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.5);
                break;
            default:
                break;
        }
    }

    // ======================== СОХРАНЕНИЕ ========================
    saveGame() {
        try {
            const data = {
                score: this.score,
                week: this.week,
                weekTimer: this.weekTimer,
                maxLines: this.maxLines,
                bridgeCount: this.bridgeCount,
                colorIndex: this.colorIndex,
                mode: this.mode,
                weeksWithoutStation: this.weeksWithoutStation,
                stations: this.stations.map(s => ({
                    x: s.x, y: s.y,
                    type: s.type,
                    capacity: s.capacity,
                    passengers: s.passengers,
                    overflowTimer: s.overflowTimer,
                    appearProgress: s.appearProgress
                })),
                lines: this.lines.map(line => ({
                    stationIndices: line.stations.map(s => this.stations.indexOf(s)),
                    color: line.color,
                    train: {
                        currentStationIndex: line.train.currentStationIndex,
                        progress: line.train.progress,
                        direction: line.train.direction,
                        passengers: line.train.passengers,
                        capacity: line.train.capacity
                    }
                }))
            };
            localStorage.setItem(this.saveKey, JSON.stringify(data));
            console.log('Игра сохранена');            
        } catch (e) {
            console.warn('Не удалось сохранить игру:', e);
        }
    }

    loadGame() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.stations || data.stations.length === 0) return false;

            this.stations = data.stations.map(s => ({
                ...s,
                passengers: s.passengers || [],
                overflowTimer: s.overflowTimer || 0,
                appearProgress: s.appearProgress !== undefined ? s.appearProgress : 1
            }));

            this.lines = [];
            this.trains = [];
            if (data.lines) {
                data.lines.forEach(lineData => {
                    const stations = lineData.stationIndices.map(idx => this.stations[idx]);
                    if (stations.length < 2) return;
                    const color = lineData.color;
                    const line = {
                        stations: stations,
                        color: color,
                        train: null
                    };
                    const train = {
                        line: line,
                        currentStationIndex: lineData.train.currentStationIndex,
                        progress: lineData.train.progress,
                        direction: lineData.train.direction,
                        passengers: lineData.train.passengers || [],
                        capacity: lineData.train.capacity || 6
                    };
                    line.train = train;
                    this.lines.push(line);
                    this.trains.push(train);
                });
            }

            this.score = data.score || 0;
            this.week = data.week || 1;
            this.weekTimer = data.weekTimer || 0;
            this.maxLines = data.maxLines || 3;
            this.bridgeCount = data.bridgeCount || 0;
            this.colorIndex = data.colorIndex || 0;
            this.mode = data.mode || null;
            this.weeksWithoutStation = data.weeksWithoutStation || 0;

            this.updateScoreDisplay();
            console.log('Игра загружена');
            return true;
        } catch (e) {
            console.warn('Не удалось загрузить игру:', e);
            return false;
        }
    }

    clearSave() {
        localStorage.removeItem(this.saveKey);
    }

    // ======================== МОДАЛЬНЫЕ ОКНА ========================
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

    // ======================== ВЫБОР РЕЖИМА ========================
    setupModeSelectionOverlay() {
        this.modeOverlay = document.createElement('div');
        this.modeOverlay.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 30;
            border-radius: 8px;
            flex-direction: column;
            color: #fff;
            font-family: sans-serif;
        `;
        this.modeOverlay.innerHTML = `
            <h2 style="font-size: 32px; margin: 0 0 16px 0;">🚇 Выберите режим</h2>
            <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
                <button data-mode="normal" style="padding:12px 24px; font-size:18px; border:none; border-radius:8px; background:#4ecdc4; color:#1a1a2e; cursor:pointer; font-weight:bold;">🟢 Обычный</button>
                <button data-mode="endless" style="padding:12px 24px; font-size:18px; border:none; border-radius:8px; background:#ffe66d; color:#1a1a2e; cursor:pointer; font-weight:bold;">♾️ Бесконечный</button>
                <button data-mode="extreme" style="padding:12px 24px; font-size:18px; border:none; border-radius:8px; background:#ff6b6b; color:#1a1a2e; cursor:pointer; font-weight:bold;">🔥 Экстремальный</button>
            </div>
            ${this.hasSave() ? '<button id="loadSaveBtn" style="margin-top:16px; padding:10px 20px; font-size:16px; border:none; border-radius:8px; background:#a29bfe; color:#1a1a2e; cursor:pointer; font-weight:bold;">📂 Загрузить сохранение</button>' : ''}
        `;
        this.container.style.position = 'relative';
        this.container.appendChild(this.modeOverlay);

        this.modeOverlay.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.setMode(mode);
            });
        });

        const loadBtn = this.modeOverlay.querySelector('#loadSaveBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.loadGame();
                this.hideModeSelection();
                this.start();
            });
        }
    }

    showModeSelection() {
        this.modeOverlay.style.display = 'flex';
    }

    hideModeSelection() {
        this.modeOverlay.style.display = 'none';
    }

    hasSave() {
        return !!localStorage.getItem(this.saveKey);
    }

    setMode(mode) {
        this.mode = mode;
        this.hideModeSelection();
        if (mode === 'normal') {
            this.weekDuration = 600;
            this.passengerInterval = 60;
        } else if (mode === 'endless') {
            this.weekDuration = 600;
            this.passengerInterval = 60;
        } else if (mode === 'extreme') {
            this.weekDuration = 300;
            this.passengerInterval = 30;
        }
        if (!this.isRunning && this.hasSave()) {
            this.loadGame();
        }
        this.start();
    }

    // ======================== GAME OVER ========================
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
            ">🔄 Новая игра</button>
            <button id="clearSaveBtn" style="margin-top:8px; padding:8px 16px; font-size:14px; border:none; border-radius:8px; background:#ff6b6b; color:#fff; cursor:pointer;">🗑️ Удалить сохранение</button>
        `;
        this.container.style.position = 'relative';
        this.container.appendChild(this.gameOverOverlay);

        this.gameOverOverlay.querySelector('#restartFromGameOverBtn').addEventListener('click', () => {
            this.resetGame();
        });
        this.gameOverOverlay.querySelector('#clearSaveBtn').addEventListener('click', () => {
            this.clearSave();
            this.toastMessage('Сохранение удалено');
        });
    }

    showGameOver() {
        this.gameOverOverlay.querySelector('#finalScore').textContent = this.score;
        this.gameOverOverlay.style.display = 'flex';
        this.hideUpgradeModal();
        this.playSound('gameOver');
        this.saveGame();
    }

    hideGameOver() {
        this.gameOverOverlay.style.display = 'none';
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isRunning = false;
        this.isPaused = true;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.showGameOver();
        this.updateScoreDisplay();
    }

    // ======================== ИНТЕРФЕЙС ========================
    updateScoreDisplay() {
        if (this.scoreDisplay) {
            const modeLabel = this.mode ?
                (this.mode === 'normal' ? '🟢' : this.mode === 'endless' ? '♾️' : '🔥') : '';
            this.scoreDisplay.textContent = `🚇 Перевезено: ${this.score} | Неделя: ${this.week} ${modeLabel}`;
        }
    }

    toastMessage(msg) {
        const el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = `
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 100;
            pointer-events: none;
            transition: opacity 0.3s;
        `;
        this.container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2000);
    }

    // ======================== ОБРАБОТКА МЫШИ И КЛАВИАТУРЫ ========================
    setupMouseEvents() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveGame();
                this.toastMessage('Игра сохранена');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                if (!this.isRunning) {
                    this.loadGame();
                    this.toastMessage('Игра загружена');
                    this.draw();
                }
            }
            if (e.key === 'Escape') {
                this.hideUpgradeModal();
                this.hideGameOver();
                this.hideModeSelection();
            }
        });
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

    onMouseUp(e) {
        // Ничего не делаем, завершение только по клику на пустом месте или двойному клику
    }

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
                this.saveGame();
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
        const w = this.MAP_WIDTH, h = this.MAP_HEIGHT;

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

        for (const line of this.lines) {
            this.drawCurvedLine(ctx, line.stations, line.color, 3);
        }

        if (this.isDrawing && this.tempLinePoints.length >= 2) {
            const color = this.currentColor || '#ffffff';
            this.drawCurvedLine(ctx, this.tempLinePoints, color, 2, true);
        }

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
            train.x = px;
            train.y = py;

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

        for (const station of this.stations) {
            const x = station.x, y = station.y;
            const size = 20;

            const ratio = station.passengers.length / station.capacity;
            const hue = 120 - ratio * 120;
            const fillColor = `hsl(${hue}, 80%, 50%)`;
            const isOverflow = station.passengers.length > station.capacity;

            const scale = station.appearProgress || 1;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.translate(-x, -y);

            ctx.fillStyle = isOverflow ? '#ff6b6b' : fillColor;
            ctx.strokeStyle = isOverflow ? '#ff0000' : '#ffffff';
            ctx.lineWidth = isOverflow ? 3 : 2;

            this.drawStationShape(ctx, station.type, x, y, size);

            ctx.restore();

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
                this.drawStationShape(ctx, pType, px, py, pSize * 2);
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

        for (const anim of this.animations) {
            if (anim.type === 'passengerBoard' || anim.type === 'passengerDisembark') {
                const progress = anim.progress;
                const from = anim.from;
                const to = anim.to;
                const cx = from.x + (to.x - from.x) * progress;
                const cy = from.y + (to.y - from.y) * progress;
                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffeb3b';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        this.drawInfoPanel(ctx);
    }

    drawInfoPanel(ctx) {
        const totalPassengers = this.stations.reduce((sum, s) => sum + s.passengers.length, 0);
        const totalCapacity = this.trains.reduce((sum, t) => sum + t.capacity, 0);

        const lines = [
            `Линий: ${this.lines.length}/${this.maxLines}`,
            `Поездов: ${this.trains.length}`,
            `Всего пассажиров: ${totalPassengers}`,
            `Вместимость поездов: ${totalCapacity}`,
            `Мостов: ${this.bridgeCount}`
        ];

        const padding = 10;
        const lineHeight = 18;
        const width = 170;
        const height = lines.length * lineHeight + padding * 2 + 30;
        const x = 10;
        const y = this.MAP_HEIGHT - height - 10;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 8);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((text, i) => {
            ctx.fillText(text, x + padding, y + padding + i * lineHeight);
        });

        ctx.fillStyle = '#4ecdc4';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const btnY = y + height - 10;
        ctx.fillText('[ Сохранить (Ctrl+S) ]', x + width/2, btnY);

        ctx.restore();
    }

    drawStationShape(ctx, type, x, y, size) {
        const half = size / 2;
        ctx.beginPath();
        switch (type) {
            case 'circle':
                ctx.arc(x, y, half, 0, Math.PI * 2);
                break;
            case 'square':
                ctx.rect(x - half, y - half, size, size);
                break;
            case 'triangle':
                ctx.moveTo(x, y - half);
                ctx.lineTo(x - half, y + half);
                ctx.lineTo(x + half, y + half);
                ctx.closePath();
                break;
            case 'star': {
                const points = 5;
                const outer = half;
                const inner = half * 0.4;
                for (let i = 0; i < points * 2; i++) {
                    const radius = i % 2 === 0 ? outer : inner;
                    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
                    const px = x + radius * Math.cos(angle);
                    const py = y + radius * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            }
            case 'cross': {
                const thick = half * 0.3;
                ctx.rect(x - thick, y - half, thick * 2, size);
                ctx.rect(x - half, y - thick, size, thick * 2);
                break;
            }
            case 'diamond': {
                ctx.moveTo(x, y - half);
                ctx.lineTo(x + half, y);
                ctx.lineTo(x, y + half);
                ctx.lineTo(x - half, y);
                ctx.closePath();
                break;
            }
            case 'hexagon': {
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
                    const px = x + half * Math.cos(angle);
                    const py = y + half * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            }
            default:
                ctx.arc(x, y, half, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
    }

    drawCurvedLine(ctx, points, color, lineWidth = 3, dashed = false) {
        if (points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) {
                ctx.lineTo(curr.x, curr.y);
                continue;
            }
            const offset = 15;
            const nx = -dy / len * offset;
            const ny = dx / len * offset;
            const cx = (prev.x + curr.x) / 2 + nx;
            const cy = (prev.y + curr.y) / 2 + ny;
            ctx.quadraticCurveTo(cx, cy, curr.x, curr.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // ======================== ИГРОВОЙ ЦИКЛ ========================
    start() {
        if (this.isRunning) return;
        if (!this.mode) {
            this.showModeSelection();
            return;
        }
        if (!this.isRunning && this.hasSave() && this.stations.length === 0) {
            this.loadGame();
        }
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.hideGameOver();
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
        this.mode = null;
        this.stations = [];
        this.lines = [];
        this.trains = [];
        this.score = 0;
        this.week = 1;
        this.weekTimer = 0;
        this.maxLines = 3;
        this.bridgeCount = 0;
        this.colorIndex = 0;
        this.animations = [];
        this.weeksWithoutStation = 0;
        this.cancelDrawing();
        this.initStations();
        this.updateScoreDisplay();
        this.draw();
        this.isRunning = false;
        this.clearSave(); // удаляем сохранение при новой игре
    }

    // ======================== ПУБЛИЧНЫЙ API ========================
    startGame() { this.start(); }
    pauseGame() { this.togglePause(); }
    resetGame() { this.newGame(); }
}