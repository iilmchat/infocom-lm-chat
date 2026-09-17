// src/games/mini-metro.js
/**
 * MiniMetro — аналог игры Mini Metro
 * Спринт 1: Базовый движок и рендеринг
 * Спринт 2: Пассажиры и базовая логика
 * Спринт 3: Создание линий, движение поездов, перевозка пассажиров
 * Спринт 4: Улучшения и ресурсы (недели, выбор бонусов)
 * Спринт 5: Рост города и условия поражения
 * Спринт 6: Визуальная полировка и новые типы
 * Спринт 7: Режимы игры и панель информации
 * Спринт 1–8: полная реализация
 * 
 * Изменено в спринте 5:
 * - Добавлена процедурная генерация новых станций (по одной в неделю)
 * - Добавлено условие поражения: станция переполнена > 10 секунд
 * - Добавлен экран Game Over с финальным счётом
 * Изменено в спринте 6:
 * - Добавлены новые типы станций: star, cross, hexagon
 * - Анимация появления новых станций (масштабирование)
 * - Анимация посадки/высадки пассажиров (плавное перемещение)
 * - Закруглённые линии (квадратичные кривые Безье)
 * - Индикатор загруженности (цвет станции от зелёного к красному)
 * Изменено в спринте 7:
 * - Добавлен выбор режимов: обычный, бесконечный, экстремальный
 * - Добавлена панель информации (линии, поезда, пассажиры, вместимость)
 * - Улучшения "Мост" и "Пересадочный узел" теперь визуализируются (счётчики)
 * Изменено в спринте 8:
 * - Добавлены звуковые эффекты через Web Audio API (посадка/высадка, Game Over, новая станция)
 * - Добавлено сохранение прогресса в localStorage (автосохранение при завершении недели и при Game Over)
 * - Загрузка сохранения при старте игры (если есть)
 * - Интеграция с интерфейсом (кнопка "Сохранить" в панели информации)
 * Исправлено в спринте 8 (корректировка):
 * - Размер карты фиксирован (800x600) с масштабированием под контейнер
 * - Уменьшена частота появления новых станций (раз в 2 недели)
 * - Все координаты станций генерируются в пределах карты
 * - Добавлена адаптивная подгонка canvas под размеры контейнера
 * Исправлено в спринте 8 (дополнительно):
 * - Увеличена длительность недели до 1200 кадров (20 секунд)
 * - Добавлено предупреждение при превышении лимита линий
 * - Линии теперь обходят станции, не входящие в линию (алгоритм с перпендикулярным смещением)
 * - Добавлена проверка на валидность станций при генерации пассажиров (защита от повреждённых данных)
 * - Исправлено движение поездов: теперь они доезжают до конечной станции, выполняют посадку/высадку и разворачиваются
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
        //this.width = 0;
        //this.height = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // --- Состояние игры ---
        // массив станций
        this.stations = [];
        // массив линий
        this.lines = [];
        // массив поездов
        this.trains = [];
        this.score = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.animationId = null;
        // Добавлено в спринте 5: флаг окончания игры
        this.isGameOver = false;

        // --- Режим игры (добавлен в спринте 7) ---
        // 'normal', 'endless', 'extreme'
        this.mode = null;           

        // --- Таймер генерации пассажиров ---
        this.passengerTimer = 0;
         // кадров между появлениями
        this.passengerInterval = 60;

        // --- Рисование линии ---
        // идет ли создание линии
        this.isDrawing = false;
        // массив станций в строящейся линии
        this.currentLineStations = [];
        // для отрисовки временной линии (массив {x,y})
        this.tempLinePoints = [];
        // цвет текущей линии
        this.currentColor = null;
        // индекс для выбора следующего цвета        
        this.colorIndex = 0;             
        // Палитра цветов линий (яркие, контрастные)
        this.lineColors = [
            // красный
            '#ff6b6b', 
            // бирюзовый
            '#4ecdc4', 
            // жёлтый
            '#ffe66d', 
            // фиолетовый
            '#a29bfe', 
            // розовый
            '#fd79a8', 
            // оранжевый
            '#fdcb6e', 
            // зелёный
            '#00b894', 
            // голубой
            '#74b9ff'  
        ];

        // --- Система улучшений ---
        // максимальное количество линий
        this.maxLines = 3;              
        // количество доступных мостов (используется для пересечения воды)
        this.bridgeCount = 0;           
        // текущая неделя
        this.week = 1;                 
        // Изменено: длительность недели увеличена до 20 секунд (1200 кадров при 60fps)
        this.weekDuration = 1200;         
        this.weekTimer = 0;
        // флаг, что неделя закончилась
        this.isWeekEnd = false;        
        // массив из двух улучшений для выбора
        this.pendingUpgrades = null;   

        // --- Добавлено в спринте 6: анимационные параметры ---
        // массив активных анимаций
        // --- Анимации ---        
        this.animations = []; 

        // --- Звуки ---
        this.audioCtx = null;
         // можно добавить переключатель
        this.soundsEnabled = true;

        // --- Сохранение ---
        this.saveKey = 'miniMetroSave';
        this.autoSaveInterval = null;

        // --- Счётчик недель без новой станции ---
        this.weeksWithoutStation = 0;        

        // --- Модальные окна ---        
        // --- Модальное окно выбора улучшений ---
        this.setupUpgradeModal();

        // --- Добавлено в спринте 5: настройка экрана Game Over ---
        this.setupGameOverOverlay();

        // --- Добавлено в спринте 7: модальное окно выбора режима ---
        this.setupModeSelectionOverlay();

        // --- Инициализация ---
        this.initStations();
        this.setupMouseEvents();
         // Добавлено в спринте 8
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
        // не более 1 (без увеличения)
        const scale = Math.min(scaleX/*, scaleY*/, 1); 

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
        /*
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
        */
    }

    // ======================== СТАНЦИИ ========================
    initStations() {
        // Добавлено в спринте 6: расширенный набор типов
        const types = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon'];
        const count = 3;
        const cx = this.MAP_WIDTH / 2;
        const cy = this.MAP_HEIGHT / 2;
         // больше радиус для карты 800x600
        const radius = 80;

        this.stations = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            this.stations.push({
                x, y,
                type: types[i % types.length],
                capacity: 10,
                // массив { type: string }
                passengers: [], 
                shape: types[i % types.length],
                // Добавлено в спринте 5: используется для подсчёта времени переполнения
                overflowTimer: 0,
                // Добавлено в спринте 6: анимация появления
                // 1 = полностью появилась
                appearProgress: 1, 
                targetAppear: 1
            });
        }
    }

    // ======================== ГЕНЕРАЦИЯ НОВЫХ СТАНЦИЙ ========================

    /**
     * Создаёт новую станцию в случайном месте, но не слишком близко к существующим.
     * Возвращает true, если удалось создать, иначе false.
     */
    addNewStation() {
        // Добавлено в спринте 6: расширенный набор типов
        // добавим ромб для разнообразия, звезду, крест и полигон
        const types = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon']; 
        const type = types[Math.floor(Math.random() * types.length)];
        const padding = 40;
        // минимальное расстояние до других станций
        // увеличено для карты 800x600
        const minDist = 120; 
        
        let attempts = 80;

        //let attempts = 50;
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
            // Добавлено в спринте 6: анимация появления (начинаем с 0)
            appearProgress: 0,
            targetAppear: 1
        };
        this.stations.push(newStation);

        // Добавляем анимацию появления
        this.animations.push({
            type: 'stationAppear',
            station: newStation,
            progress: 0,
            // кадров
            duration: 30 
        });

        // Добавлено в спринте 8: звук появления новой станции
        this.playSound('stationAppear');

        return true;
    }

    // ======================== ПАССАЖИРЫ ========================
    /**
     * Генерирует пассажира на случайной станции.
     * Исправлено: добавлена проверка на валидность станции и наличие типов.
     */    
    generatePassenger() {
        // Проверяем, есть ли станции
        if (this.stations.length === 0) return;

        const station = this.stations[Math.floor(Math.random() * this.stations.length)];
        // Дополнительная проверка на валидность станции (защита от повреждённых данных)
        if (!station || !station.type || station.capacity === undefined) return;

        if (station.passengers.length >= station.capacity) return;

        // Добавлено в спринте 6: используем все типы, кроме текущего
        const allTypes = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'hexagon'];
        const available = allTypes.filter(t => t !== station.type);
         // если нет других типов (маловероятно)
        if (available.length === 0) return;

        const destType = available[Math.floor(Math.random() * available.length)];

        station.passengers.push({ type: destType });
    }

    // ======================== ЛИНИИ И ПОЕЗДА ========================

    /**
     * Создаёт новую линию из переданного массива станций.
     * Присваивает ей цвет, создаёт поезд и добавляет в списки.
     */
    createLine(stationsArray) {
        // Проверяем лимит линий
        if (this.lines.length >= this.maxLines) {
            return null;
        }
        if (stationsArray.length < 2) return null;

        const color = this.lineColors[this.colorIndex % this.lineColors.length];
        this.colorIndex++;

        const line = {
            // копия массива
            stations: stationsArray.slice(), 
            color: color,
            // будет создан ниже
            train: null 
        };

        // Создаём поезд на этой линии
        const train = {
            line: line,
            // индекс станции, к которой движется
            currentStationIndex: 0,        
            // от 0 до 1 (доля пути между станциями)
            progress: 0,                   
            // 1 — вперёд, -1 — назад
            direction: 1,                 
            // пассажиры в поезде (массив { type: string }) 
            passengers: [],               
            // начальная вместимость (можно увеличивать)
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
     * Исправлено: поезд теперь доезжает до конечной станции, выполняет посадку/высадку и разворачивается.
     */
    updateTrains() {
        // скорость движения между станциями (чем больше, тем быстрее)
        const speed = 0.005; 

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

                // Если вышли за пределы — достигли конца линии
                if (nextIndex < 0 || nextIndex >= stations.length) {
                    // Мы на конечной станции: выполняем посадку/высадку
                    const currentStation = stations[train.currentStationIndex];
                    this.processStation(train, currentStation);
                    // Разворачиваемся
                    train.direction *= -1;
                    // Продолжаем цикл (не переходим на другую станцию)
                    continue;
                } else {
                    // Переходим на следующую станцию
                    train.currentStationIndex = nextIndex;
                    const currentStation = stations[train.currentStationIndex];
                    this.processStation(train, currentStation);
                } 

                /*
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

                // ----- ВЫСАДКА пассажиров (с анимацией) -----
                const toRemove = [];
                for (let i = 0; i < train.passengers.length; i++) {
                    if (train.passengers[i].type === currentStation.type) {
                        toRemove.push(i);
                        // увеличиваем счёт за перевезённого пассажира
                        this.score++; 
                        // Добавлено в спринте 6: анимация высадки
                        this.animations.push({
                            type: 'passengerDisembark',
                            // будет вычислено позже
                            from: { x: train.x, y: train.y }, 
                            to: { x: currentStation.x, y: currentStation.y },
                            progress: 0,
                            duration: 20
                        });
                        // Добавлено в спринте 8: звук высадки
                        this.playSound('disembark');
                    }
                }
                // Удаляем высаженных (в обратном порядке)
                for (let i = toRemove.length - 1; i >= 0; i--) {
                    train.passengers.splice(toRemove[i], 1);
                }

                // ----- ПОСАДКА пассажиров со станции  (с анимацией) -----
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
                    // Добавлено в спринте 6: анимация посадки
                    this.animations.push({
                        type: 'passengerBoard',
                        from: { x: currentStation.x, y: currentStation.y },
                        // будет вычислено позже
                        to: { x: train.x, y: train.y }, 
                        progress: 0,
                        duration: 20
                    });
                    // Добавлено в спринте 8: звук посадки
                    this.playSound('board');
                }
                    */
            }
        }
    }

    /**
     * Обработка посадки/высадки на станции.
     * Вынесено в отдельный метод для устранения дублирования.
     */
    processStation(train, station) {
        // Высадка
        const toRemove = [];
        for (let i = 0; i < train.passengers.length; i++) {
            if (train.passengers[i].type === station.type) {
                toRemove.push(i);
                this.score++;
                this.animations.push({
                    type: 'passengerDisembark',
                    from: { x: train.x, y: train.y },
                    to: { x: station.x, y: station.y },
                    progress: 0,
                    duration: 20
                });
                this.playSound('disembark');
            }
        }
        for (let i = toRemove.length - 1; i >= 0; i--) {
            train.passengers.splice(toRemove[i], 1);
        }

        // Посадка
        const line = train.line;
        const stations = line.stations;
        const futureTypes = new Set();
        let idx = train.currentStationIndex + train.direction;
        while (idx >= 0 && idx < stations.length) {
            futureTypes.add(stations[idx].type);
            idx += train.direction;
        }

        const stationPassengers = station.passengers;
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
                from: { x: station.x, y: station.y },
                to: { x: train.x, y: train.y },
                progress: 0,
                duration: 20
            });
            this.playSound('board');
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
            let anyOverflow = false;
            // 10 секунд при 60fps
            const overflowThreshold = 10 * 60;

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
                // Если это анимация появления станции, устанавливаем финальное состояние
                if (anim.type === 'stationAppear') {
                    anim.station.appearProgress = 1;
                }
                this.animations.splice(i, 1);
            } else {
                // Обновляем прогресс для станции
                if (anim.type === 'stationAppear') {
                    anim.station.appearProgress = anim.progress;
                }
            }
        }
    }

    // ======================== ЗАВЕРШЕНИЕ НЕДЕЛИ ======================== 
    /**
     * Завершение недели: генерируем два случайных улучшения и показываем модальное окно.
     * Игра ставится на паузу.
     * Добавлено в спринте 5: также добавляем новую станцию.
     */
    endWeek() {
        // Добавлено в спринте 5: добавляем новую станцию в начале каждой недели
        // Добавляем новую станцию        
        /*
        this.addNewStation();        
        */

        // Добавляем станцию не каждую неделю, а раз в 2 недели
        this.weeksWithoutStation++;
        if (this.weeksWithoutStation >= 2) {
            this.weeksWithoutStation = 0;
            this.addNewStation();
        } else {
            // Можно добавить с вероятностью 50% (дополнительно)
            // 30% шанс добавить раньше
            if (Math.random() < 0.3) { 
                this.addNewStation();
                this.weeksWithoutStation = 0;
            }
        }
                
       /*
        const stationAdded = this.addNewStation();
        if (stationAdded) {
            // Можно показать уведомление (но у нас нет тостов внутри игры, пока просто игнорируем)
            // Новая станция появится с анимацией
        }
        */

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

        // Сохранение
        this.saveGame();
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
        if (this.isRunning && !this.isGameOver) {
            this.loop();
        }
        // Добавлено в спринте 8: сохраняем после улучшения
        this.saveGame();
    }

    // ======================== ЗВУКИ ========================

    /**
     * Инициализация аудиоконтекста (ленивая).
     */
    initAudio() {
        if (!this.audioCtx) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API не поддерживается');
                this.soundsEnabled = false;
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /**
     * Воспроизведение звукового эффекта.
     * @param {string} type - 'board', 'disembark', 'stationAppear', 'gameOver'
     */
    playSound(type) {
        if (!this.soundsEnabled) return;
        this.initAudio();
        if (!this.audioCtx) return;

        const ctx = this.audioCtx;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Настройка звуков
        switch (type) {
            // посадка — короткий высокий звук
            case 'board': 
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.1);
                break;
            // высадка — короткий низкий звук
            case 'disembark': 
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.1);
                break;
             // новая станция — восходящий тон
            case 'stationAppear':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
                gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.15);
                break;
             // поражение — нисходящий тон
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

    /**
     * Сохраняет текущее состояние игры в localStorage.
     */
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
                //,
                //trains: [] // не нужно, так как уже в линиях
            };
            localStorage.setItem(this.saveKey, JSON.stringify(data));
            console.log('Игра сохранена');
        } catch (e) {
            console.warn('Не удалось сохранить игру:', e);
        }
    }

    /**
     * Загружает сохранение из localStorage.
     * Возвращает true, если загрузка успешна.
     */
    loadGame() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data || !data.stations || data.stations.length === 0) return false;

            // Восстанавливаем станции с проверкой на валидность
            this.stations = data.stations
                .filter(s => s && s.type && s.x !== undefined && s.y !== undefined)
                .map(s => ({
                ...s,
                passengers: s.passengers || [],
                overflowTimer: s.overflowTimer || 0,
                appearProgress: s.appearProgress !== undefined ? s.appearProgress : 1
            }));

            if (this.stations.length === 0) {
                // Если после фильтрации станций не осталось, инициализируем заново
                this.initStations();
                return true;
            }

            // Восстанавливаем линии и поезда
            this.lines = [];
            this.trains = [];
            if (data.lines) {
                data.lines.forEach(lineData => {
                    const stations = lineData.stationIndices
                        .map(idx => this.stations[idx])
                         // отбрасываем undefined
                        .filter(s => s);
                    if (stations.length < 2) return;
                    const color = lineData.color;
                    const line = {
                        stations: stations,
                        color: color,
                        train: null
                    };
                    const train = {
                        line: line,
                        currentStationIndex: Math.min(lineData.train.currentStationIndex, stations.length - 1),
                        progress: lineData.train.progress || 0,
                        direction: lineData.train.direction || 1,
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

    /**
     * Удаляет сохранение.
     */
    clearSave() {
        localStorage.removeItem(this.saveKey);
        console.log('Сохранение удалено');
    }

    // ======================== МОДАЛЬНОЕ ОКНО УЛУЧШЕНИЙ ========================
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

        // Обработчики кнопок
        this.modeOverlay.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                // Если есть сохранение, спросим, загружать ли его (но можно просто начать новую игру)
                this.setMode(mode);
            });
        });

        const loadBtn = this.modeOverlay.querySelector('#loadSaveBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.loadGame();
                this.hideModeSelection();
                // запускаем с загруженным состоянием
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
        // Применяем настройки режима
        if (mode === 'normal') {
            // сохранено увеличенное значение
            this.weekDuration = 1200;
            this.passengerInterval = 120;
            // Скорость поездов оставляем стандартной
        } else if (mode === 'endless') {
            this.weekDuration = 1200;
            this.passengerInterval = 120;
            // В бесконечном режиме отключаем поражение
        } else if (mode === 'extreme') {
            // неделя короче
            // для экстрима оставляем более быстрый темп
            this.weekDuration = 600; 
            // пассажиры появляются чаще
            this.passengerInterval = 60; 
            
        }
        // Можно увеличить скорость поездов, но оставим как есть

        // Если уже есть сохранение и игра не запущена, загружаем его
        if (!this.isRunning && this.hasSave()) {
            this.loadGame();
        }
        this.start();        
        // Запускаем игру (если ещё не запущена)
        /*
        if (!this.isRunning) {
            this.start();
        } else {
            // Если игра уже запущена, перезапускаем с новыми настройками
            this.resetGame();
        }
        */
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
            <button id="restartFromGameOverBtn" style="padding:12px 32px; font-size:20px; border:none; border-radius:8px; background:#4ecdc4; color:#1a1a2e; cursor:pointer; font-weight:bold;">🔄 Новая игра</button>
            <button id="clearSaveBtn" style="margin-top:8px; padding:8px 16px; font-size:14px; border:none; border-radius:8px; background:#ff6b6b; color:#fff; cursor:pointer;">🗑️ Удалить сохранение</button>
        `;
        this.container.style.position = 'relative';
        this.container.appendChild(this.gameOverOverlay);

        // Обработчик кнопки перезапуска
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
        // скрываем модалку улучшений, если она была открыта
        this.hideUpgradeModal(); 
        // Добавлено в спринте 8: звук Game Over
        this.playSound('gameOver');
        // Сохраняем результат
        this.saveGame();
    }

    hideGameOver() {
        this.gameOverOverlay.style.display = 'none';
    }

    // ======================== УСЛОВИЕ ПОРАЖЕНИЯ (Добавлено в спринте 5) ========================

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isRunning = false;
        // останавливаем обновления
        this.isPaused = true; 
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.showGameOver();
        // Можно также обновить счётчик на экране
        this.updateScoreDisplay();
    }

    // ======================== ИНТЕРФЕЙС ========================
    updateScoreDisplay() {
        if (this.scoreDisplay) {
            //this.scoreDisplay.textContent = `🚇 Перевезено: ${this.score} | Неделя: ${this.week}`;
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

    // ======================== ОБРАБОТКА МЫШИ ========================
    setupMouseEvents() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));
    }

    // Добавлено в спринте 8: клавиатурные сокращения
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+S — сохранить
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveGame();
                this.toastMessage('Игра сохранена');
            }
            // Ctrl+L — загрузить (если игра не запущена)
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                if (!this.isRunning) {
                    this.loadGame();
                    this.toastMessage('Игра загружена');
                    this.draw();
                }
            }
            // Escape — закрыть модалки
            if (e.key === 'Escape') {
                this.hideUpgradeModal();
                this.hideGameOver();
                this.hideModeSelection();
            }
        });
    }

    // Простое всплывающее сообщение (заглушка, можно заменить на toast)
    toastMessage(msg) {
        // Создаём временный элемент
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
    

    /**
     * Определяет, находится ли точка (x,y) внутри станции.
     * Возвращает индекс станции или -1.
     */
    getStationAt(x, y) {
        // размер станции
        const radius = 20;
        for (let i = 0; i < this.stations.length; i++) {
            const s = this.stations[i];
            if (!s) continue;
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
            // Клик по станции
            const station = this.stations[stationIndex];
            if (!station) return;

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
         if (!this.isRunning || this.isPaused || this.isGameOver) return;
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
                // Добавлено в спринте 8: сохранение после создания линии
                this.saveGame();
            } else {
                // Добавлено: предупреждение о превышении лимита линий
                this.toastMessage('⚠️ Достигнут лимит линий!');
                this.cancelDrawing();
                // Можно показать уведомление
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
        //const w = this.width, h = this.height;
        const w = this.MAP_WIDTH, h = this.MAP_HEIGHT;

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

        // --- РИСОВАНИЕ ЛИНИЙ с обходом станций ---
        // Постоянные линии
        for (const line of this.lines) {
            //this.drawLine(ctx, line.stations, line.color, 3);
            this.drawCurvedLine(ctx, line.stations, line.color, 3);
        }

        // Временная линия (строящаяся)
        if (this.isDrawing && this.tempLinePoints.length >= 2) {
            const color = this.currentColor || '#ffffff';
            //this.drawLine(ctx, this.tempLinePoints, color, 2, true);
            this.drawCurvedLine(ctx, this.tempLinePoints, color, 2, true);
        }

        // --- РИСОВАНИЕ ПОЕЗДОВ ---
        for (const train of this.trains) {
            const line = train.line;
            const stations = line.stations;
            if (stations.length < 2) continue;

            // Вычисляем текущую позицию поезда
            const idx = train.currentStationIndex;
            const nextIdx = idx + train.direction;
            // защита
            if (nextIdx < 0 || nextIdx >= stations.length) continue; 

            const from = stations[idx];
            const to = stations[nextIdx];
            // 0..1
            const t = train.progress; 

            const px = from.x + (to.x - from.x) * t;
            const py = from.y + (to.y - from.y) * t;
            // Сохраняем позицию для анимаций
            train.x = px;
            train.y = py;

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
        // --- РИСОВАНИЕ СТАНЦИЙ ---
        for (const station of this.stations) {
            if (!station) continue;
            const x = station.x, y = station.y;
            const size = 20;

            // Если станция переполнена, рисуем красную окантовку (Добавлено в спринте 5)
            // Индикатор загруженности (цвет от зелёного к красному)
            const ratio = station.passengers.length / station.capacity;
            // 120 (зелёный) -> 0 (красный)
            const hue = 120 - ratio * 120; 
            const fillColor = `hsl(${hue}, 80%, 50%)`;            
            const isOverflow = station.passengers.length > station.capacity;

            // Применяем масштаб для анимации появления
            const scale = station.appearProgress || 1;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.translate(-x, -y);

            ctx.fillStyle = isOverflow ? '#ff6b6b' : fillColor;
            ctx.strokeStyle = isOverflow ? '#ff0000' : '#ffffff';
            ctx.lineWidth = isOverflow ? 3 : 2;

            // Рисуем форму станции в зависимости от типа
            this.drawStationShape(ctx, station.type, x, y, size);

            ctx.restore();

            /* Удалено на 6 спринте
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
            */

            // Пассажиры
            // Пассажиры (маленькие фигурки)
            // Пассажиры (отрисовываются без масштабирования, чтобы не искажаться)            
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


                /* Удалено на 6 спринте
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
                */
                // Рисуем форму пассажира (используем ту же функцию, но с меньшим размером)
                this.drawStationShape(ctx, pType, px, py, pSize * 2);               
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

        // --- АНИМАЦИИ ПОСАДКИ/ВЫСАДКИ ---
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

        // --- Добавлено в спринте 7: ПАНЕЛЬ ИНФОРМАЦИИ ---
        this.drawInfoPanel(ctx);
    }

// ======================== ИНФОРМАЦИОННАЯ ПАНЕЛЬ ========================    
    /**
     * Отрисовка панели информации в левом нижнем углу.
     * Добавлено в спринте 7.
     */
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

        // Добавлено в спринте 8: кнопка сохранения в панели информации (интерактив)
        const padding = 10;
        const lineHeight = 18;
        //const width = 160;
        //const height = lines.length * lineHeight + padding * 2 + 30; // дополнительное место для кнопки
        const width = 170;
        const height = lines.length * lineHeight + padding * 2 + 30;        
        const x = 10;
        //const y = this.height - height - 10;
        const y = this.MAP_HEIGHT - height - 10;

        ctx.save();
        // Полупрозрачный фон
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

        // Кнопка сохранения (просто текст с подчёркиванием)
        ctx.fillStyle = '#4ecdc4';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const btnY = y + height - 10;
        ctx.fillText('[ Сохранить (Ctrl+S) ]', x + width/2, btnY);
        // Можно добавить обработчик клика на эту область, но для простоты оставим только клавиши.

        ctx.restore();
    }

    /**
     * Рисование закруглённого прямоугольника (полифилл для roundRect).
     */
    roundRect(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ======================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ОТРИСОВКИ ========================    
    /**
     * Вспомогательная функция для отрисовки геометрической фигуры станции/пассажира.
     * Добавлено в спринте 6: поддержка новых типов.
     */
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
             // fallback
            default:
                ctx.arc(x, y, half, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Рисование линии с закруглениями на станциях (квадратичные кривые).
     * Добавлено в спринте 6.
     */
    /**
     * Рисование линии с обходом станций, не принадлежащих линии.
     * Алгоритм:
     * - Для каждой пары соседних станций проверяем все остальные станции.
     * - Если какая-то станция находится ближе порога к отрезку, то добавляем промежуточную точку,
     *   смещённую перпендикулярно отрезку, чтобы обойти препятствие.
     * - Собираем итоговый массив точек для рисования.
     * 
     * Изменено в спринте 8 (дополнительно):
     * - Добавлен обход препятствий.
     */    
    drawCurvedLine(ctx, points, color, lineWidth = 3, dashed = false) {
        if (points.length < 2) return;

        // Преобразуем точки в массив объектов {x, y}
        const pts = points.map(p => ({ x: p.x, y: p.y }));

        // Строим путь с обходом препятствий
        const pathPoints = this.buildPathWithObstacleAvoidance(pts);

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        /*
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            */
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
            const prev = pathPoints[i - 1];
            const curr = pathPoints[i];           
            // Вычисляем контрольную точку как среднюю между prev и curr со смещением перпендикулярно
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) {
                ctx.lineTo(curr.x, curr.y);
                continue;
            }
            // Смещение для закругления (маленькое, чтобы линия слегка изгибалась)
            // Небольшое закругление
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

    /**
     * Построение пути с обходом станций, не входящих в линию.
     * @param {Array} points - массив точек (станций) линии
     * @returns {Array} массив точек для рисования (с промежуточными точками обхода)
     */
    buildPathWithObstacleAvoidance(points) {
        if (points.length < 2) return points;

        const result = [];
         // радиус вокруг станции, который нужно обходить
        const obstacleRadius = 25;

        // Проходим по всем отрезкам линии
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            // Добавляем начальную точку (если это первый отрезок)
            if (i === 0) result.push({ x: p1.x, y: p1.y });

            // Проверяем все станции, кроме тех, что являются концами отрезка
            const obstacles = this.stations.filter(s => {
                // Исключаем станции, которые являются частью линии (сравниваем по ссылке)
                const isEndpoint = points.some(p => p === s);
                return !isEndpoint && s;
            });

            let segmentStart = { x: p1.x, y: p1.y };
            let segmentEnd = { x: p2.x, y: p2.y };

            // Для каждого препятствия проверяем, не пересекает ли оно отрезок
            for (const obs of obstacles) {
                if (!obs) continue;
                const dist = this.distancePointToSegment(obs, segmentStart, segmentEnd);
                if (dist < obstacleRadius) {
                    // Находим проекцию точки на отрезок
                    const proj = this.projectPointOnSegment(obs, segmentStart, segmentEnd);
                    // Если проекция находится внутри отрезка и не совпадает с концами
                    if (proj.t > 0.1 && proj.t < 0.9) {
                        // Смещаем точку перпендикулярно отрезку
                        const dx = segmentEnd.x - segmentStart.x;
                        const dy = segmentEnd.y - segmentStart.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len < 1) continue;
                        // Нормаль
                        const nx = -dy / len;
                        const ny = dx / len;
                        // Смещение (в сторону от препятствия)
                        const sign = this.pointSide(obs, segmentStart, segmentEnd) > 0 ? 1 : -1;
                        const offset = obstacleRadius + 10;
                        const newX = proj.x + nx * sign * offset;
                        const newY = proj.y + ny * sign * offset;
                        // Добавляем точку обхода
                        result.push({ x: newX, y: newY });
                        // Обновляем начало следующего отрезка
                        segmentStart = { x: newX, y: newY };
                    }
                }
            }

            // Добавляем конечную точку отрезка (если это не последний отрезок, то она будет добавлена на следующей итерации как начальная)
            if (i === points.length - 2) {
                result.push({ x: p2.x, y: p2.y });
            }
        }

        // Если точек меньше 2, возвращаем исходные
        if (result.length < 2) return points;
        return result;
    }

    /**
     * Расстояние от точки до отрезка.
     */
    distancePointToSegment(point, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) {
            return Math.hypot(point.x - a.x, point.y - a.y);
        }
        let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const projX = a.x + t * dx;
        const projY = a.y + t * dy;
        return Math.hypot(point.x - projX, point.y - projY);
    }

    /**
     * Проекция точки на отрезок, возвращает {x, y, t}.
     */
    projectPointOnSegment(point, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return { x: a.x, y: a.y, t: 0 };
        let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return { x: a.x + t * dx, y: a.y + t * dy, t: t };
    }

    /**
     * Определяет, с какой стороны от отрезка находится точка (знак).
     */
    pointSide(point, a, b) {
        return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
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

    // ======================== ИГРОВОЙ ЦИКЛ ========================

    start() {
        if (this.isRunning) return;
        // Если режим не выбран, показываем выбор
        if (!this.mode) {
            this.showModeSelection();
            return;
        }
        // Если есть сохранение и игра не запущена, загружаем (если не загружено ранее)
        if (!this.isRunning && this.hasSave() && this.stations.length === 0) {
            this.loadGame();
        }
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.hideGameOver();
        /*
        this.score = 0;
        this.week = 1;
        this.weekTimer = 0;        

        // Сбрасываем линии и поезда (на случай перезапуска)
        this.lines = [];
        this.trains = [];
        this.colorIndex = 0;
        this.maxLines = 3;
        this.bridgeCount = 0;        
        this.animations = [];
        this.cancelDrawing();
        this.stations = [];
        this.initStations();        
        */
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
        // Сброс состояния
        this.hideGameOver();
        this.isGameOver = false;        
        // Сбрасываем режим, чтобы при следующем старте показать выбор
        this.mode = null;
        this.stations = [];
        this.lines = [];
        this.trains = [];
        this.score = 0;
        this.week = 1;
        this.weekTimer = 0;
        this.maxLines = 3;
        this.bridgeCount = 0;        
        //this.passengerTimer = 0;
        this.colorIndex = 0;
        this.animations = [];
        this.weeksWithoutStation = 0;
        this.cancelDrawing();
        this.initStations();
        this.updateScoreDisplay();
        this.draw();
        // Не вызываем start() автоматически — покажем выбор режима
        // Пользователь нажмёт Старт заново или выберет режим
        // чтобы можно было стартовать снова
        this.isRunning = false; 
        // Показываем выбор режима при следующем старте
        // Очищаем сохранение? По желанию можно оставить или удалить. Оставим пока.
        // удаляем сохранение при новой игре
        this.clearSave(); 

    }

    // ======================== ПУБЛИЧНЫЙ API ========================
    startGame() {
        // Если режим не выбран, показываем выбор (это также делает start())
        this.start();
    }
    pauseGame() { this.togglePause(); }
    resetGame() {
        // Полный сброс, но режим сохраняется? По задумке, при нажатии "Новая игра" режим сохраняется.
        // Но в оригинале Mini Metro при новой игре предлагают выбрать режим. Мы сделаем так:
        // при reset сбрасываем режим, чтобы пользователь мог выбрать заново.
        // Однако кнопка "Новая игра" в интерфейсе вызывает resetGame(), и это правильно.
        // Но если пользователь хочет перезапустить в том же режиме, он может использовать кнопку "Новая игра" в модалке Game Over.
        // Для универсальности оставим сброс режима.
        this.newGame();
    }
}