// src/services/api-service.js
import { SERVER_CONFIG, CONFIG } from '../config.js';
import { fetchWithRetry } from '../utils/network-helpers.js';

/**
 * Сервис для взаимодействия с API сервера
 * Обрабатывает все сетевые запросы, управляет моделями и потоковыми ответами
 */
export class ApiService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.availableModels = [];
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
        this.isConnected = false;
        this._connectionAttempts = 0;
        this._maxAccumulatedSize = 1000000;
    }

    /**
     * Проверка доступности сервера с расширенной диагностикой
     * @returns {Promise<{status: boolean, error?: string}>}
     */
    async checkServer() {
        const result = { status: false, error: null };
        this._connectionAttempts++;
        
        try {
            const timeout = SERVER_CONFIG.timeout * 1000;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const startTime = Date.now();
            
            const response = await fetchWithRetry(
                `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.HEALTH_ENDPOINT}`,
                { 
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                },
                2
            );

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;

            if (response.ok) {
                result.status = true;
                this.isConnected = true;
                this._connectionAttempts = 0;
                
                console.log(`✅ Сервер доступен (ответ за ${responseTime}мс)`);
                
                if (this.eventBus) {
                    this.eventBus.emit('server:connected', { responseTime });
                }
                
                // Загрузка моделей после успешного подключения
                const modelsLoaded = await this.fetchModels();
                if (!modelsLoaded) {
                    result.error = 'Модели не загружены';
                    console.warn('⚠️ Сервер доступен, но модели не загружены');
                }
                
                return result;
            } else {
                result.error = `HTTP ${response.status}`;
                console.warn(`⚠️ Сервер вернул ошибку: ${response.status}`);
            }

        } catch (error) {
            const errorMessage = error.name === 'AbortError' 
                ? 'Таймаут подключения'
                : error.message;
            
            result.error = errorMessage;
            console.error('❌ Ошибка при проверке сервера:', errorMessage);
            
            if (error.cause) {
                console.debug('Причина ошибки:', error.cause);
            }
        }

        this.isConnected = false;
        
        if (this.eventBus) {
            this.eventBus.emit('server:disconnected', { 
                error: result.error,
                timestamp: new Date().toISOString(),
                attempts: this._connectionAttempts
            });
        }

        return result;
    }

    /**
     * Загрузка списка доступных моделей с таймаутом и валидацией
     * @returns {Promise<boolean>} - Успешность загрузки
     */
    async fetchModels() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.warn('⏱️ Таймаут при загрузке моделей');
            }, SERVER_CONFIG.timeout * 1000);

            const url = `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.MODELS_ENDPOINT}`;
            const response = await fetchWithRetry(
                url,
                { signal: controller.signal },
                2
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Валидация данных
            if (!data?.data || !Array.isArray(data.data)) {
                throw new Error('Некорректный формат ответа');
            }

            // Извлечение идентификаторов моделей
            const models = data.data
                .map(model => model.id || model)
                .filter(Boolean); // Удаляем null/undefined

            if (models.length === 0) {
                throw new Error('Список моделей пуст');
            }

            this.availableModels = models;
            
            // Выбор модели: сначала loaded, потом первую доступную
            this.currentModel = models.find(model => 
                typeof model === 'string' && model.includes('loaded')
            ) || models[0];

            if (this.eventBus) {
                this.eventBus.emit('models:updated', {
                    models: this.availableModels,
                    current: this.currentModel
                });
            }

            console.log(`📦 Загружено моделей: ${models.length}, выбрана: ${this.currentModel}`);
            return true;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('⏱️ Превышено время ожидания при загрузке моделей');
            } else {
                console.error('❌ Ошибка при загрузке моделей:', error.message);
            }
            
            if (this.eventBus) {
                this.eventBus.emit('models:error', { 
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
            
            return false;
        }
    }

    /**
     * Отправка сообщения с потоковой обработкой ответа
     * @param {Object} payload - Тело запроса
     * @param {Function} onChunk - Callback при получении чанка
     * @param {Function} onComplete - Callback при завершении
     * @param {Function} onError - Callback при ошибке
     * @param {number} maxAccumulatedSize - Максимальный размер аккумулированного текста
     * @returns {Promise<string>}
     */
    async sendMessage(payload, onChunk, onComplete, onError, maxAccumulatedSize = 1000000) {
        const controller = new AbortController();
        let timeoutId = null;

        try {
            timeoutId = setTimeout(() => {
                controller.abort();
                console.warn('⏱️ Превышено время ожидания ответа');
                if (onError) {
                    onError(new Error('⏱️ Превышено время ожидания ответа от сервера'));
                }
            }, SERVER_CONFIG.timeout * 1000);

            // Добавляем текущую модель в payload
            const requestPayload = {
                ...payload,
                model: payload.model || this.currentModel
            };

            const response = await fetchWithRetry(
                `${SERVER_CONFIG.baseUrl}${SERVER_CONFIG.apiPath}`,
                {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream'
                    },
                    body: JSON.stringify(requestPayload),
                    signal: controller.signal
                },
                2
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Сервер вернул ошибку ${response.status}: ${errorText}`);
            }

            if (!response.body) {
                throw new Error('Сервер не передал тело ответа');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        if (onComplete) {
                            onComplete(accumulated);
                        }
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        
                        if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
                            continue;
                        }

                        const dataContent = trimmedLine.slice(6);
                        
                        if (dataContent === '[DONE]') {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(dataContent);
                            
                            const content = parsed?.choices?.[0]?.delta?.content;
                            
                            if (content === undefined || content === null) {
                                continue;
                            }

                            if (accumulated.length + content.length > maxAccumulatedSize) {
                                console.warn('⚠️ Достигнут максимальный размер ответа');
                                if (onError) {
                                    onError(new Error('Превышен максимальный размер ответа'));
                                }
                                return accumulated;
                            }

                            accumulated += content;
                            
                            if (onChunk) {
                                try {
                                    onChunk(accumulated);
                                } catch (callbackError) {
                                    console.warn('⚠️ Ошибка в onChunk:', callbackError);
                                }
                            }

                        } catch (parseError) {
                            console.debug('Ошибка парсинга JSON:', parseError.message);
                        }
                    }
                }

                return accumulated;

            } finally {
                try {
                    reader.releaseLock();
                } catch (e) {
                    // Игнорируем ошибки освобождения
                }
            }

        } catch (error) {
            clearTimeout(timeoutId);
            
            console.error('❌ Ошибка при отправке сообщения:', {
                message: error.message,
                name: error.name
            });

            if (onError) {
                try {
                    const errorMessage = error.name === 'AbortError' 
                        ? '⏱️ Превышено время ожидания'
                        : `❌ Ошибка: ${error.message}`;
                    onError(new Error(errorMessage));
                } catch (callbackError) {
                    console.error('Ошибка в onError callback:', callbackError);
                }
            }

            throw error;
        }
    }

    /**
     * Получение эмбеддинга для текста с повторными попытками
     * @param {string} text - Текст для векторизации
     * @returns {Promise<number[]>} - Вектор эмбеддинга
     */
    async getEmbedding(text) {
        if (!text || typeof text !== 'string') {
            console.warn('⚠️ Пустой текст для эмбеддинга');
            return this._generateFallbackEmbedding();
        }

        try {
            const response = await fetchWithRetry(
                `${SERVER_CONFIG.baseUrl}${CONFIG.SERVER.EMBEDDINGS_ENDPOINT}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: CONFIG.RAG.EMBEDDING_MODEL,
                        input: text.trim()
                    })
                },
                2
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            
            if (!data?.data?.[0]?.embedding) {
                throw new Error('Некорректный ответ сервера эмбеддингов');
            }
            
            return data.data[0].embedding;

        } catch (error) {
            console.error('❌ Ошибка получения эмбеддинга:', error.message);
            console.warn('⚠️ Используется fallback-эмбеддинг');
            return this._generateFallbackEmbedding();
        }
    }

    /**
     * Генерация fallback-эмбеддинга
     * @param {number} size - Размерность вектора
     * @returns {number[]}
     * @private
     */
    _generateFallbackEmbedding(size = 768) {
        const vector = Array.from({ length: size }, () => Math.random() - 0.5);
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / (norm || 1));
    }

    /**
     * Получение статуса сервиса
     * @returns {Object} - Информация о состоянии
     */
    getStatus() {
        return {
            connected: this.isConnected,
            modelsLoaded: this.availableModels.length > 0,
            availableModels: this.availableModels,
            currentModel: this.currentModel,
            connectionAttempts: this._connectionAttempts,
            config: {
                baseUrl: SERVER_CONFIG.baseUrl,
                timeout: SERVER_CONFIG.timeout
            }
        };
    }

    /**
     * Сброс состояния (для восстановления после ошибок)
     */
    resetState() {
        this.availableModels = [];
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
        this.isConnected = false;
        this._connectionAttempts = 0;
        
        if (this.eventBus) {
            this.eventBus.emit('state:reset');
        }
        
        console.log('🔄 Состояние ApiService сброшено');
    }

    // Геттеры для обратной совместимости
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
            console.log(`🔄 Модель изменена на: ${model}`);
            return true;
        }
        console.warn(`⚠️ Модель "${model}" не найдена в списке доступных`);
        return false;
    }
}