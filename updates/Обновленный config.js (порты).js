// src/config.js
export const CONFIG = {
    VERSION: '5.0',
    SERVER: {
        DEFAULT_IP: 'localhost',
        DEFAULT_PORT: 8032,           // API сервер
        CLIENT_PORT: 8033,            // index.html
        LM_PORT: 8034,                // LM Studio
        DEFAULT_TIMEOUT: 60,
        DEFAULT_MAX_TOKENS: 2048,
        DEFAULT_API_PATH: '/v1/chat/completions',
        HEALTH_ENDPOINT: '/health',
        MODELS_ENDPOINT: '/v1/models',
        EMBEDDINGS_ENDPOINT: '/v1/embeddings',
        CHECK_INTERVAL: 30000,
        TEMPERATURE: 0.6,
        REVIEW_TEMPERATURE: 0.3,
        POLLING_INTERVAL: 3000,       // Интервал между опросами
        POLLING_TIMEOUT: 30           // Таймаут Long Polling
    },
    // ... остальные настройки
};