// src/core/event-bus.js
/**
 * Центральная шина событий для слабосвязанной коммуникации между модулями
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Подписка на событие
     * @param {string} event - Название события
     * @param {Function} callback - Обработчик
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    /**
     * Отписка от события
     * @param {string} event - Название события
     * @param {Function} callback - Обработчик
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    /**
     * Вызов события
     * @param {string} event - Название события
     * @param {*} data - Данные события
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
    }

    /**
     * Одноразовая подписка
     * @param {string} event - Название события
     * @param {Function} callback - Обработчик
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    /**
     * Очистка всех подписок
     */
    clear() {
        this.listeners.clear();
    }
}