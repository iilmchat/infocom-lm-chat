// src/ui/components/section-toggle.js
/**
 * Компонент для сворачивания/разворачивания секций
 * Поддерживает сохранение состояния в localStorage
 */
export class SectionToggle {
    constructor() {
        this.sections = new Map();
        this.storageKey = 'section_states';
        this.loadStates();
        this.setupEventListeners();
    }

    /**
     * Загружает состояния секций из localStorage
     */
    loadStates() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                Object.entries(parsed).forEach(([id, state]) => {
                    this.sections.set(id, state);
                });
            }
        } catch (error) {
            console.warn('Ошибка загрузки состояний секций:', error);
        }
    }

    /**
     * Сохраняет состояния секций в localStorage
     */
    saveStates() {
        try {
            const data = {};
            this.sections.forEach((state, id) => {
                data[id] = state;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.warn('Ошибка сохранения состояний секций:', error);
        }
    }

    /**
     * Получает состояние секции
     * @param {string} id - ID секции
     * @returns {boolean} true - развернута, false - свернута
     */
    getState(id) {
        return this.sections.get(id) !== false; // По умолчанию false
    }

    /**
     * Устанавливает состояние секции
     * @param {string} id - ID секции
     * @param {boolean} state - true - развернута, false - свернута
     */
    setState(id, state) {
        this.sections.set(id, state);
        this.saveStates();
        this.updateSectionUI(id);
    }

    /**
     * Переключает состояние секции
     * @param {string} id - ID секции
     */
    toggle(id) {
        const currentState = this.getState(id);
        this.setState(id, !currentState);
        return !currentState;
    }

    /**
     * Обновляет UI секции в соответствии с состоянием
     * @param {string} id - ID секции
     */
    updateSectionUI(id) {
        const section = document.getElementById(id);
        const header = section?.previousElementSibling;

        if (!section || !header) {
            return;
        }

        const isCollapsed = !this.getState(id);

        // Обновляем классы
        section.classList.toggle('collapsed', isCollapsed);
        header.classList.toggle('collapsed', isCollapsed);

        // Обновляем иконку стрелки
        const arrowSpan = header.querySelector('span:last-child');
        if (arrowSpan) {
            arrowSpan.textContent = isCollapsed ? '▶' : '▼';
        }

        // Обновляем aria-атрибуты для доступности
        header.setAttribute('aria-expanded', !isCollapsed);
        section.setAttribute('aria-hidden', isCollapsed);
    }

    /**
     * Инициализирует секцию
     * @param {string} id - ID секции
     * @param {HTMLElement} header - Заголовок секции
     * @param {HTMLElement} content - Содержимое секции
     */
    initSection(id, header, content) {
        if (!header || !content) {
            console.warn(`Секция ${id} не найдена`);
            return;
        }

        // Устанавливаем начальное состояние
        const isCollapsed = !this.getState(id);

        // Добавляем классы
        content.id = id;
        content.className = `section-content${isCollapsed ? ' collapsed' : ''}`;
        header.className = `section-header${isCollapsed ? ' collapsed' : ''}`;

        // Добавляем стрелку, если её нет
        const arrowSpan = header.querySelector('span:last-child');
        if (arrowSpan) {
            arrowSpan.textContent = isCollapsed ? '▶' : '▼';
        }

        // Добавляем aria-атрибуты
        header.setAttribute('aria-expanded', !isCollapsed);
        content.setAttribute('aria-hidden', isCollapsed);

        // Устанавливаем обработчик клика
        header.onclick = () => {
            this.toggle(id);
        };

        // Сохраняем ссылки
        this.sections.set(id, !isCollapsed);
    }

    /**
     * Инициализирует все секции на странице
     * @param {Object} sections - Объект с секциями { id: { header: element, content: element } }
     */
    initAll(sections) {
        Object.entries(sections).forEach(([id, elements]) => {
            this.initSection(id, elements.header, elements.content);
        });
    }

    /**
     * Находит и инициализирует все секции по селекторам
     * @param {string} headerSelector - Селектор для заголовков секций
     * @param {string} contentSelector - Селектор для содержимого секций
     */
    autoInit(headerSelector = '.section-header', contentSelector = '.section-content') {
        const headers = document.querySelectorAll(headerSelector);
        const contents = document.querySelectorAll(contentSelector);

        headers.forEach((header, index) => {
            const content = contents[index];
            if (content && header.dataset.section) {
                const id = header.dataset.section || content.id || `section-${index}`;
                this.initSection(id, header, content);
            }
        });
    }

    /**
     * Настраивает обработчики событий
     */
    setupEventListeners() {
        // Обработка изменения состояния через события
        document.addEventListener('section:toggle', (e) => {
            if (e.detail && e.detail.id) {
                this.toggle(e.detail.id);
            }
        });

        // Обработка клавиатуры (Enter/Space на заголовках)
        document.addEventListener('keydown', (e) => {
            const header = e.target.closest('.section-header');
            if (!header) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const content = header.nextElementSibling;
                if (content && content.classList.contains('section-content')) {
                    const id = content.id || header.dataset.section;
                    if (id) {
                        this.toggle(id);
                    }
                }
            }
        });
    }

    /**
     * Сбрасывает все секции в развернутое состояние
     */
    expandAll() {
        this.sections.forEach((_, id) => {
            this.setState(id, true);
        });
    }

    /**
     * Сворачивает все секции
     */
    collapseAll() {
        this.sections.forEach((_, id) => {
            this.setState(id, false);
        });
    }

    /**
     * Получает все состояния секций
     * @returns {Object} { id: state }
     */
    getAllStates() {
        const states = {};
        this.sections.forEach((state, id) => {
            states[id] = state;
        });
        return states;
    }
}

// Создаем и экспортируем синглтон
const sectionToggle = new SectionToggle();
export default sectionToggle;