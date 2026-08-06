// src/services/api-service.js
import { SERVER_CONFIG, CONFIG } from '../config.js';
import { fetchWithRetry } from '../utils/network-helpers.js';

/**
 * Сервис для взаимодействия с API сервера
 */
export class ApiService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.availableModels = [];
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
    }

    async checkServer() {
        try {
            const timeout = SERVER_CONFIG.timeout * 1000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetchWithRetry(
                `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.HEALTH_ENDPOINT}`,
                { signal: controller.signal },
                2
            );

            clearTimeout(timeoutId);

            if (response.ok) {
                if (this.eventBus) {
                    this.eventBus.emit('server:connected');
                }
                await this.fetchModels();
                return true;
            }
        } catch (error) {
            console.error('Ошибка при проверке сервера:', error);
        }

        if (this.eventBus) {
            this.eventBus.emit('server:disconnected');
        }
        return false;
    }

    async fetchModels() {
        try {
            const url = `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.MODELS_ENDPOINT}`;
            const response = await fetchWithRetry(url);

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            const data = await response.json();

            if (data?.data?.length) {
                this.availableModels = data.data.map(model => model.id || model);
                if (this.availableModels.length) {
                    this.currentModel = this.availableModels.find(model => model.includes('loaded')) || this.availableModels[0];
                    
                    if (this.eventBus) {
                        this.eventBus.emit('models:updated', {
                            models: this.availableModels,
                            current: this.currentModel
                        });
                    }
                }
                return true;
            }
        } catch (error) {
            console.error('Ошибка при загрузке моделей:', error);
        }
        return false;
    }

    async sendMessage(payload, onChunk, onComplete, onError) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                if (onError) onError(new Error('⏱️ Превышено время ожидания'));
            }, SERVER_CONFIG.timeout * 1000);

            const response = await fetchWithRetry(
                `${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.apiPath}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                },
                2
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`HTTP ${response.status}: ${err}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                accumulated += content;
                                if (onChunk) onChunk(accumulated);
                            }
                        } catch (e) {
                            // Игнорируем ошибки парсинга
                        }
                    }
                }
            }

            if (onComplete) onComplete(accumulated);
            return accumulated;

        } catch (error) {
            if (error.name === 'AbortError') {
                if (onComplete) onComplete('', true);
                return '';
            }
            if (onError) onError(error);
            throw error;
        }
    }

    async getEmbedding(text) {
        try {
            const response = await fetch(
                `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.EMBEDDINGS_ENDPOINT}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: CONFIG.RAG.EMBEDDING_MODEL,
                        input: text
                    })
                }
            );

            if (!response.ok) {
                throw new Error('Ошибка получения эмбеддинга');
            }

            const data = await response.json();
            return data.data[0].embedding;
        } catch (error) {
            console.warn('Используется fallback-эмбеддинг из-за ошибки:', error);
            return Array(768).fill(0).map(() => Math.random() - 0.5);
        }
    }

    getModels() {
        return [...this.availableModels];
    }

    getCurrentModel() {
        return this.currentModel;
    }

    setCurrentModel(model) {
        if (this.availableModels.includes(model)) {
            this.currentModel = model;
            if (this.eventBus) {
                this.eventBus.emit('model:changed', model);
            }
            return true;
        }
        return false;
    }
}