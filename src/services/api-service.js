// src/services/api-service.js
import { SERVER_CONFIG, CONFIG } from '../config.js';
import { fetchWithRetry } from '../utils/network-helpers.js';

/**
 * Сервис для взаимодействия с API сервера
 * Обрабатывает все сетевые запросы, управляет моделями и потоковыми ответами
 */

/**
 * Сервис для работы с API сервера
 */
export class ApiService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        //this.SERVER_CONFIG = { ...SERVER_CONFIG };        
        this.availableModels = [];
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
        this.isConnected = false;
        //this.lastCheck = 0;
        //this.pendingRequests = new Map();        
        this._connectionAttempts = 0;
        this._maxAccumulatedSize = 1000000;

        // Хранилище активных AbortController для возможности отмены извне
        this._activeControllers = new Map();
        this._requestIdCounter = 0;

        // DOM элементы
        this.statusDisplay = document.getElementById('statusDisplay');    
        this.errorMsg = document.getElementById('errorMsg'); 
       
   
        // Загружаем конфигурацию
        //loadServerConfig();
        //this.loadConfig();                   
    }

    loadConfig() {
        try {
            const saved = localStorage.getItem('server_config');
            if (saved) {
                const config = JSON.parse(saved);
                Object.assign(this.SERVER_CONFIG, config);
            }
        } catch (e) {
            console.warn('Не удалось загрузить конфиг сервера:', e);
        }
    }

    saveConfig() {
        try {
            localStorage.setItem('server_config', JSON.stringify(this.SERVER_CONFIG));
        } catch (e) {
            console.warn('Не удалось сохранить конфиг сервера:', e);
        }
    }

    get baseUrl() {
        return `http://${this.SERVER_CONFIG.ip}:${this.SERVER_CONFIG.port}`;
    }
    
    /**
     * Проверка доступности сервера с расширенной диагностикой
     * @returns {Promise<{status: boolean, error?: string}>}
     */
    /**
     * Проверка доступности сервера
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
                
                // Сервер доступен - обновляем отображение статуса
                this.statusDisplay.textContent = '● Сервер доступен';
                this.statusDisplay.style.color = 'var(--text-accent)';
                this.errorMsg.style.display = 'none';

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

        // В случае ошибки или неуспешного ответа - обновляем отображение статуса
        this.statusDisplay.textContent = '● Сервер НЕ ДОСТУПЕН';
        this.statusDisplay.style.color = 'var(--error-color)';
        this.errorMsg.style.display = 'block';        

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
     * Отмена активного запроса по его ID
     * @param {string|number} requestId - ID запроса для отмены
     * @returns {boolean} - Успешность отмены
     */
    abortRequest(requestId) {
        const controller = this._activeControllers.get(requestId);
        if (controller) {
            controller.abort();
            this._activeControllers.delete(requestId);
            console.log(`🛑 Запрос ${requestId} отменён`);
            return true;
        }
        console.warn(`⚠️ Запрос ${requestId} не найден или уже завершён`);
        return false;
    }

    /**
     * Отмена всех активных запросов
     * @returns {number} - Количество отменённых запросов
     */
    abortAllRequests() {
        const count = this._activeControllers.size;
        for (const [id, controller] of this._activeControllers) {
            controller.abort();
            console.log(`🛑 Запрос ${id} отменён (массовая отмена)`);
        }
        this._activeControllers.clear();
        console.log(`🛑 Отменено ${count} активных запросов`);
        return count;
    }

    /**
     * Отправка сообщения с потоковой обработкой ответа
     * Поддерживает отмену через внешний signal или через requestId
     * 
     * @param {Object} payload - Тело запроса
     * @param {Function} onChunk - Callback при получении чанка
     * @param {Function} onComplete - Callback при завершении
     * @param {Function} onError - Callback при ошибке
     * @param {AbortSignal} externalSignal - Внешний сигнал для отмены (из chat-view)
     * @param {number} maxAccumulatedSize - Максимальный размер аккумулированного текста
     * @returns {Promise<{requestId: string|number, result: string}>}
     */
    async sendMessage(
        payload, 
        onChunk, 
        onComplete, 
        onError, 
        externalSignal = null, 
        maxAccumulatedSize = 1000000
    ) {
        // Генерируем уникальный ID для запроса
        const requestId = ++this._requestIdCounter;
        
        // Создаём внутренний AbortController
        const internalController = new AbortController();
        
        // Сохраняем контроллер для возможности отмены извне
        this._activeControllers.set(requestId, internalController);
        
        // Объединяем внешний и внутренний сигналы
        let combinedSignal = internalController.signal;
        
        // Если передан внешний signal, объединяем их
        if (externalSignal) {
            // Создаём составной сигнал
            const compositeController = new AbortController();
            
            const onExternalAbort = () => {
                compositeController.abort();
                // Удаляем из активных при отмене
                this._activeControllers.delete(requestId);
            };
            
            const onInternalAbort = () => {
                compositeController.abort();
                // Удаляем из активных при отмене
                this._activeControllers.delete(requestId);
            };
            
            // Подписываемся на оба сигнала
            if (externalSignal.aborted) {
                onExternalAbort();
            } else {
                externalSignal.addEventListener('abort', onExternalAbort, { once: true });
            }
            
            internalController.signal.addEventListener('abort', onInternalAbort, { once: true });
            
            combinedSignal = compositeController.signal;
            
            // Очищаем слушатели при завершении
            const cleanup = () => {
                try {
                    externalSignal.removeEventListener('abort', onExternalAbort);
                } catch (e) {
                    // Игнорируем
                }
                this._activeControllers.delete(requestId);
            };
            
            // Сохраняем cleanup для вызова в finally
            combinedSignal._cleanup = cleanup;
        }
        
        //const controller = new AbortController();
        let timeoutId = null;
        let isAborted = false;

        try {
            timeoutId = setTimeout(() => {
                console.warn(`⏱️ Таймаут запроса ${requestId}`);
                console.warn('⏱️ Превышено время ожидания ответа');
                internalController.abort();
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
                    signal: combinedSignal
                },
                2
            );

            clearTimeout(timeoutId);

            // Проверяем, не был ли запрос отменён
            if (combinedSignal.aborted) {
                isAborted = true;
                if (onComplete) {
                    onComplete(null, true); // aborted = true
                }
                return { requestId, result: null, aborted: true };
            }

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
                    // Проверяем сигнал перед каждым чтением
                    if (combinedSignal.aborted) {
                        isAborted = true;
                        // Прерываем чтение
                        try {
                            await reader.cancel();
                        } catch (e) {
                            // Игнорируем ошибки отмены
                        }
                        break;
                    }

                    const { done, value } = await reader.read();
                    
                    // Проверяем сигнал после чтения
                    if (combinedSignal.aborted) {
                        isAborted = true;
                        break;
                    }
                    
                    if (done) {
                        if (!isAborted && onComplete) {
                            onComplete(accumulated, false);
                        }
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        // Проверяем сигнал при обработке каждой строки
                        if (combinedSignal.aborted) {
                            isAborted = true;
                            break;
                        }

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
                                console.warn(`⚠️ Достигнут максимальный размер ответа (${requestId})`);
                                if (onError) {
                                    onError(new Error('Превышен максимальный размер ответа'));
                                }
                                return { requestId, result: accumulated, aborted: false };
                            }

                            accumulated += content;
                            
                            if (onChunk) {
                                try {
                                    onChunk(accumulated);
                                } catch (callbackError) {
                                    console.warn(`⚠️ Ошибка в onChunk (${requestId}):`, callbackError);
                                }
                            }

                        } catch (parseError) {
                            console.debug(`Ошибка парсинга JSON (${requestId}):`, parseError.message);
                        }
                    }
                }

                // Если запрос был отменён, вызываем onComplete с aborted = true
                if (isAborted) {
                    if (onComplete) {
                        onComplete(accumulated || null, true);
                    }
                    return { requestId, result: accumulated, aborted: true };
                }

                return { requestId, result: accumulated, aborted: false };

            } finally {
                try {
                    reader.releaseLock();
                } catch (e) {
                    // Игнорируем ошибки освобождения
                }
                
                // Удаляем контроллер из активных
                this._activeControllers.delete(requestId);
                
                // Вызываем cleanup для внешнего сигнала
                if (combinedSignal._cleanup) {
                    try {
                        combinedSignal._cleanup();
                    } catch (e) {
                        // Игнорируем
                    }
                }
            }

        } catch (error) {
            clearTimeout(timeoutId);
            
            // Проверяем, не была ли это отмена
            if (error.name === 'AbortError' || error.message?.includes('abort')) {
                isAborted = true;
                if (onComplete) {
                    onComplete(null, true);
                }
                this._activeControllers.delete(requestId);
                return { requestId, result: null, aborted: true };
            }
            
            console.error(`❌ Ошибка при отправке сообщения (${requestId}):`, {
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
                    console.error(`Ошибка в onError callback (${requestId}):`, callbackError);
                }
            }

            this._activeControllers.delete(requestId);
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
            activeRequests: this._activeControllers.size,
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
        // Отменяем все активные запросы
        this.abortAllRequests();
        
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