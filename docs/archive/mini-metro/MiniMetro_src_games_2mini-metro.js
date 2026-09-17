// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 2: Пассажиры и базовая логика
 */
export class MiniMetroGame {
    constructor(container) {
        this.container = container;

        // Холст
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Элемент для отображения счета
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.style.cssText = 'text-align:center;font-size:16px;margin-top:8px;color:var(--text-primary);';
        this.scoreDisplay.textContent = '🚇 Перевезено: 0';
        this.container.appendChild(this.scoreDisplay);

        // Размеры
        this.width = 0;
        this.height = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Состояние игры
        this.stations = [];
        this.score = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationId = null;

        // Таймер генерации пассажиров
        this.passengerTimer = 0;
        this.passengerInterval = 60; // кадров между появлениями

        // Инициализация стартовых станций
        this.initStations();
        this.draw();
    }

    // === Управление размерами ===
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

    // === Создание трёх стартовых станций ===
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
                passengers: [], // массив пассажиров: { type: string }
                shape: types[i % types.length],
                overflowTimer: 0 // для будущей механики переполнения
            });
        }
    }

    // === Генерация одного пассажира ===
    generatePassenger() {
        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
        if (!station) return;
        if (station.passengers.length >= station.capacity) return;

        const types = ['circle', 'square', 'triangle'];
        const available = types.filter(t => t !== station.type);
        const destType = available[Math.floor(Math.random() * available.length)];

        station.passengers.push({ type: destType });
    }

    // === Обновление состояния ===
    update() {
        // Генерация пассажиров с заданным интервалом
        this.passengerTimer++;
        if (this.passengerTimer >= this.passengerInterval) {
            this.passengerTimer = 0;
            const count = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                this.generatePassenger();
            }
        }

        // Обновление счётчика на экране (пока просто отображаем)
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        if (this.scoreDisplay) {
            this.scoreDisplay.textContent = `🚇 Перевезено: ${this.score}`;
        }
    }

    // === Отрисовка ===
    draw() {
        const ctx = this.ctx;
        const w = this.width, h = this.height;

        // Фон
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        // Сетка (имитация воды)
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

        // Станции и пассажиры
        this.stations.forEach(station => {
            const x = station.x, y = station.y;
            const size = 20;

            // Рисуем станцию
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

            // Отрисовка пассажиров (маленькие фигурки вокруг станции)
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

            // Подпись типа станции (для наглядности)
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(station.type, x, y + size/2 + 14);
        });
    }

    // === Игровой цикл ===
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
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
    }

    newGame() {
        this.stop();
        this.stations = [];
        this.score = 0;
        this.passengerTimer = 0;
        this.initStations();
        this.updateScoreDisplay();
        this.draw();
        this.start();
    }

    // === Публичный API для кнопок ===
    startGame() { this.start(); }
    pauseGame() { this.togglePause(); }
    resetGame() { this.newGame(); }
}