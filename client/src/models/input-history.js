// src/models/input-history.js
import { CONFIG } from '../config.js';

/**
 * История ввода сообщений (Ctrl+↑ / Ctrl+↓)
 */
export class InputHistory {
    constructor(maxSize = CONFIG.HISTORY.MAX_INPUT_HISTORY) {
        this.history = [];
        this.maxSize = maxSize;
        this.currentIndex = -1;
        this.savedValue = '';
        this.enabled = true;
    }

    push(text) {
        if (!text || !text.trim()) return;
        this.history = this.history.filter(item => item !== text);
        this.history.push(text);
        if (this.history.length > this.maxSize) {
            this.history.shift();
        }
        this.currentIndex = this.history.length;
        this.savedValue = '';
    }

    getPrevious(currentText) {
        if (!this.enabled || this.history.length === 0) return null;

        if (this.currentIndex === this.history.length) {
            this.savedValue = currentText;
        }

        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.history[this.currentIndex];
        }
        return this.history[0];
    }

    getNext(currentText) {
        if (!this.enabled || this.history.length === 0) return null;

        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            return this.history[this.currentIndex];
        } else if (this.currentIndex === this.history.length - 1) {
            this.currentIndex = this.history.length;
            return this.savedValue || '';
        }
        return null;
    }

    reset() {
        this.currentIndex = this.history.length;
        this.savedValue = '';
    }

    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.savedValue = '';
    }

    getHistory() {
        return [...this.history];
    }

    getCurrentIndex() {
        return this.currentIndex;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    isEnabled() {
        return this.enabled;
    }
}