// src/models/rate-limiter.js
import { CONFIG } from '../config.js';

/**
 * Ограничитель частоты запросов
 */
export class RateLimiter {
    constructor(maxRequests = CONFIG.RATE.LIMIT_MAX, windowMs = CONFIG.RATE.LIMIT_WINDOW) {
        this.requests = [];
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    isAllowed() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        if (this.requests.length >= this.maxRequests) return false;
        this.requests.push(now);
        return true;
    }

    getRemaining() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        return Math.max(0, this.maxRequests - this.requests.length);
    }

    reset() {
        this.requests = [];
    }

    getStats() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        return {
            remaining: Math.max(0, this.maxRequests - this.requests.length),
            total: this.requests.length,
            max: this.maxRequests,
            windowMs: this.windowMs
        };
    }
}