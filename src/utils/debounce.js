// src/utils/debounce.js

/**
 * Функция debounce для ограничения частоты вызовов
 * @param {Function} fn - Функция для выполнения
 * @param {number} delay - Задержка в миллисекундах
 * @param {Object} options - Дополнительные опции
 * @returns {Function} - Debounced функция
 */
export function debounce(fn, delay = 300, options = {}) {
    let timeoutId = null;
    let lastArgs = null;
    let lastThis = null;
    let result = null;
    let isPending = false;

    const {
        leading = false,
        trailing = true,
        maxWait = null
    } = options;

    let maxTimerId = null;
    let lastCallTime = null;

    function invokeFunc() {
        const args = lastArgs;
        const context = lastThis;
        
        lastArgs = null;
        lastThis = null;
        isPending = false;
        
        result = fn.apply(context, args);
        return result;
    }

    function startTimer(pendingFn, wait) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(pendingFn, wait);
    }

    function startMaxTimer() {
        if (maxWait && !maxTimerId) {
            maxTimerId = setTimeout(() => {
                if (isPending) {
                    invokeFunc();
                }
                maxTimerId = null;
            }, maxWait);
        }
    }

    function debounced(...args) {
        lastArgs = args;
        lastThis = this;
        lastCallTime = Date.now();
        isPending = true;

        if (leading && !timeoutId) {
            result = invokeFunc();
            startMaxTimer();
        }

        startTimer(() => {
            if (maxTimerId) {
                clearTimeout(maxTimerId);
                maxTimerId = null;
            }
            if (trailing && isPending) {
                result = invokeFunc();
            }
            timeoutId = null;
        }, delay);

        startMaxTimer();
        return result;
    }

    debounced.cancel = function() {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (maxTimerId) {
            clearTimeout(maxTimerId);
            maxTimerId = null;
        }
        lastArgs = null;
        lastThis = null;
        isPending = false;
    };

    debounced.flush = function() {
        if (isPending) {
            return invokeFunc();
        }
        return result;
    };

    return debounced;
}

/**
 * Специализированный debounce для подсветки с настройками по умолчанию
 */
export function highlightDebounce(fn, delay = 300) {
    return debounce(fn, delay, {
        leading: false,
        trailing: true,
        maxWait: 500
    });
}