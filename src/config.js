// src/config.js
/**
 * Глобальная конфигурация приложения
 * Изменено в 5.2: добавлены MARKDOWN, расширения для DOCX
 * Изменено в 5.3 — добавлен .pdf в разрешённые расширения
 * Изменено в 6.1: обновлена версия до 6.1, добавлены настройки для новых модулей
 */
/* Изменено в 5.3 — добавлен .pdf в разрешённые расширения */

export const CONFIG = {
    /* Изменено в 6.1: версия обновлена до 6.1 */
    VERSION: '6.1',
    SERVER: {
        /*
        DEFAULT_IP: '222.1.1.31',
        DEFAULT_PORT: 8034,
        */
        DEFAULT_IP: '222.1.1.99',
        DEFAULT_LM_IP: '222.1.1.31',
        // API сервер
        DEFAULT_PORT: 8032,  
        // index.html            
        CLIENT_PORT: 8033,   
        // LM Studio
        LM_PORT: 8034,                     
        DEFAULT_TIMEOUT: 60,
        DEFAULT_MAX_TOKENS: 131072,
        DEFAULT_API_PATH: '/v1/chat/completions',
        HEALTH_ENDPOINT: '/health',
        MODELS_ENDPOINT: '/v1/models',
        EMBEDDINGS_ENDPOINT: '/v1/embeddings',
        CHECK_INTERVAL: 30000,
        TEMPERATURE: 0.4,
        REVIEW_TEMPERATURE: 0.2,
        // Интервал между опросами
        POLLING_INTERVAL: 3000,
        // Таймаут Long Polling       
        POLLING_TIMEOUT: 30           
    },
    RAG: {
        ENABLED: true,
        MAX_CHUNKS: 500,
        CHUNK_SIZE: 1000,
        TOP_K: 3,
        MIN_SIMILARITY: 0.3,
        EMBEDDING_MODEL: 'text-embedding-nomic-embed-text-v1.5',
        TIMEOUT: 5000
    },
    MESSAGE: {
        MAX_LENGTH: 10000,
        WARNING_THRESHOLD: 0.85
    },
    ACHIEVEMENTS: {
        TOTAL: 20
    },
    THEMES: ['dark', 'light', 'monokai'],
    DEBOUNCE: {
        SAVE: 1000,
        STATS: 2000,
        SEARCH: 300
    },
    SYSTEM_PROMPT: `Ты — мощная модель для программирования. Отвечай на русском, если вопрос на русском. Пиши код с комментариями.`,
    LIMITS: {
        // 10MB
        MAX_FILE_SIZE: 10 * 1024 * 1024, 
        MAX_INPUT_LENGTH: 10000,
        MAX_MESSAGES_KEEP: 60,
        MAX_ATTACHMENTS: 20,
        MAX_PROMPT_TOKENS: 2048
    },
    SECURITY: {
        SANITIZE_INPUT: true,
        SANITIZE_HTML: true,
        ALLOW_CODE_EXECUTION: false,
        // Добавлено в 5.2: поддержка .docx
        ALLOWED_EXTENSIONS: [
            '.txt', '.js', '.py', '.java', '.cpp', '.cs', '.sql', '.md',
            '.json', '.xml', '.csv', '.html', '.css', '.rb', '.go', '.rs',
            '.php', '.sh', '.ps1'
            ,'.docx' /* Добавлено в 5.2 */
            ,'.pdf'   /* Добавлено в 5.4 */
        ],
        FORBIDDEN_PATTERNS: [
            /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
            /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
            /on\w+\s*=/gi,
            /javascript:/gi
        ],
        MAX_INPUT_LENGTH: 10000
    },
    RATE: {
        LIMIT_MAX: 10,
        LIMIT_WINDOW: 60000
    },
    HISTORY: {
        MAX_INPUT_HISTORY: 50
    },
    VIRTUAL_SCROLL: {
        ITEM_HEIGHT: 80,
        BUFFER: 5
    },
    RETRIES: {
        MAX_RETRIES: 5,
        RETRY_DELAY: 1000
    },
    MULTI_USER: {
        SIMULATED_USERS: true,
        USER_COUNT: 3
    },
    DRAG_AND_DROP: {
        ENABLED: true,
        MAX_FILES: 20,
        ALLOWED_MODES: ['rag', 'attachment'],
        DEFAULT_MODE: 'rag',
        PREVIEW_THUMBNAILS: true,
        SHOW_PROGRESS: true
    },    
    UI_CONFIG: {
        DEFAULT_THEME: 'dark',
        TYPING_DELAY: 300,
        TOAST_DURATION: 3000,
        MAX_HISTORY_PREVIEW: 30,
        DEFAULT_MODEL: 'local-model',
        MAX_TOASTS: 5
    },
    // Добавлено в 5.2: настройки Markdown
    MARKDOWN: {
        ENABLED: true,
        SANITIZE_HTML: true
    },
    /* Добавлено в 6.1: настройки для статистики и аналитики */
    ANALYTICS: {
        DEFAULT_PERIOD: 'week', // 'day' | 'week' | 'month'
        REFRESH_INTERVAL: 60000, // 1 минута
        MAX_HISTORY_POINTS: 30
    }
};

/**
 * Конфигурация сервера с динамическими настройками
 */
export const SERVER_CONFIG = {
    ip: CONFIG.SERVER.DEFAULT_IP,
    port: CONFIG.SERVER.DEFAULT_PORT,
    ip_lm: CONFIG.SERVER.DEFAULT_LM_IP,
    port_lm: CONFIG.SERVER.LM_PORT,
    timeout: CONFIG.SERVER.DEFAULT_TIMEOUT,
    maxTokens: CONFIG.SERVER.DEFAULT_MAX_TOKENS,
    apiPath: CONFIG.SERVER.DEFAULT_API_PATH,
    
    get baseUrl() {
        return `http://${this.ip}:${this.port}`;
    },
    get baseUrlLM() {
        return `http://${this.ip_lm}:${this.port_lm}`;
    },    
    get healthEndpoint() {
        return '/health';
    },
    get modelsEndpoint() {
        return '/v1/models';
    },
    get chatEndpoint() {
        return this.apiPath;
    },
    get embeddingsEndpoint() {
        return '/v1/embeddings';
    }
};

/**
 * Загружает конфигурацию сервера из localStorage
 */
export function loadServerConfig() {
    try {
        const configString = localStorage.getItem('server_config');
        if (configString) {
            const parsedConfig = JSON.parse(configString);
            Object.assign(SERVER_CONFIG, parsedConfig);
        }
    } catch (error) {
        console.warn('Не удалось загрузить конфигурацию сервера из localStorage:', error);
    }
}

/**
 * Сохраняет конфигурацию сервера в localStorage
 */
export function saveServerConfig() {
    try {
        const serverConfig = {
            ip: SERVER_CONFIG.ip,
            port: SERVER_CONFIG.port,
            ip_lm: SERVER_CONFIG.ip_lm,
            port_lm: SERVER_CONFIG.port_lm,
            timeout: SERVER_CONFIG.timeout,
            maxTokens: SERVER_CONFIG.maxTokens,
            apiPath: SERVER_CONFIG.apiPath
        };
        localStorage.setItem('server_config', JSON.stringify(serverConfig));
    } catch (error) {
        console.warn('Не удалось сохранить конфигурацию сервера в localStorage');
    }
}