@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo Создание структуры проекта Infocom LM Chat...
echo.

REM Создание основной структуры каталогов
mkdir infocom-lm-chat 2>nul
cd infocom-lm-chat

REM Создание HTML файла
echo ^<!DOCTYPE html^> > index.html
echo ^<html lang="ru"^> >> index.html
echo ^<head^> >> index.html
echo     ^<meta charset="UTF-8"^> >> index.html
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^> >> index.html
echo     ^<title^>Infocom LM Chat Pro v5.0^</title^> >> index.html
echo     ^<link rel="stylesheet" href="src/styles/main.css"^> >> index.html
echo ^</head^> >> index.html
echo ^<body^> >> index.html
echo     ^<div id="app"^>^</div^> >> index.html
echo     ^<script type="module" src="src/app.js"^>^</script^> >> index.html
echo ^</body^> >> index.html
echo ^</html^> >> index.html

REM Создание структуры src
mkdir src 2>nul
mkdir src\core 2>nul
mkdir src\models 2>nul
mkdir src\services 2>nul
mkdir src\ui 2>nul
mkdir src\ui\components 2>nul
mkdir src\ui\views 2>nul
mkdir src\ui\renderers 2>nul
mkdir src\games 2>nul
mkdir src\utils 2>nul
mkdir src\styles 2>nul

REM Создание файлов в src
echo // Главная точка входа приложения > src\app.js
echo. >> src\app.js
echo import { CONFIG, SERVER_CONFIG, loadServerConfig } from './config.js'; >> src\app.js
echo import { EventBus } from './core/event-bus.js'; >> src\app.js
echo import { ToastManager } from './ui/components/toast.js'; >> src\app.js
echo import { SessionManager } from './models/session-manager.js'; >> src\app.js
echo import { RAGManager } from './models/rag-manager.js'; >> src\app.js
echo // ... остальные импорты >> src\app.js
echo. >> src\app.js
echo class App { >> src\app.js
echo     constructor() { >> src\app.js
echo         this.eventBus = new EventBus(); >> src\app.js
echo         this.toast = new ToastManager(); >> src\app.js
echo         // ... инициализация менеджеров >> src\app.js
echo     } >> src\app.js
echo. >> src\app.js
echo     async init() { >> src\app.js
echo         // ... загрузка данных >> src\app.js
echo     } >> src\app.js
echo } >> src\app.js
echo. >> src\app.js
echo const app = new App(); >> src\app.js
echo app.init(); >> src\app.js

REM Создание config.js
echo // src/config.js > src\config.js
echo export const CONFIG = { >> src\config.js
echo     VERSION: '5.0', >> src\config.js
echo     SERVER: { >> src\config.js
echo         DEFAULT_IP: '222.1.1.31', >> src\config.js
echo         DEFAULT_PORT: 8034, >> src\config.js
echo         DEFAULT_TIMEOUT: 60, >> src\config.js
echo         DEFAULT_MAX_TOKENS: 2048, >> src\config.js
echo         DEFAULT_API_PATH: '/v1/chat/completions', >> src\config.js
echo         HEALTH_ENDPOINT: '/health', >> src\config.js
echo         MODELS_ENDPOINT: '/v1/models', >> src\config.js
echo         EMBEDDINGS_ENDPOINT: '/v1/embeddings', >> src\config.js
echo         CHECK_INTERVAL: 30000, >> src\config.js
echo         TEMPERATURE: 0.6, >> src\config.js
echo         REVIEW_TEMPERATURE: 0.3 >> src\config.js
echo     }, >> src\config.js
echo     RAG: { >> src\config.js
echo         ENABLED: true, >> src\config.js
echo         MAX_CHUNKS: 500, >> src\config.js
echo         CHUNK_SIZE: 1000, >> src\config.js
echo         TOP_K: 3, >> src\config.js
echo         MIN_SIMILARITY: 0.3, >> src\config.js
echo         EMBEDDING_MODEL: 'text-embedding-nomic-embed-text-v1.5' >> src\config.js
echo     }, >> src\config.js
echo     MESSAGE: { >> src\config.js
echo         MAX_LENGTH: 10000, >> src\config.js
echo         WARNING_THRESHOLD: 0.85 >> src\config.js
echo     }, >> src\config.js
echo     LIMITS: { >> src\config.js
echo         MAX_FILE_SIZE: 10 * 1024 * 1024, >> src\config.js
echo         MAX_INPUT_LENGTH: 10000, >> src\config.js
echo         MAX_MESSAGES_KEEP: 60, >> src\config.js
echo         MAX_ATTACHMENTS: 20 >> src\config.js
echo     }, >> src\config.js
echo     SECURITY: { >> src\config.js
echo         SANITIZE_INPUT: true, >> src\config.js
echo         SANITIZE_HTML: true, >> src\config.js
echo         ALLOWED_EXTENSIONS: ['.txt','.js','.py','.java','.cpp','.cs','.sql','.md','.json','.xml','.csv','.html','.css','.rb','.go','.rs','.php','.sh','.ps1'] >> src\config.js
echo     }, >> src\config.js
echo     RATE: { >> src\config.js
echo         LIMIT_MAX: 10, >> src\config.js
echo         LIMIT_WINDOW: 60000 >> src\config.js
echo     }, >> src\config.js
echo     HISTORY: { >> src\config.js
echo         MAX_INPUT_HISTORY: 50 >> src\config.js
echo     }, >> src\config.js
echo     RETRIES: { >> src\config.js
echo         MAX_RETRIES: 5, >> src\config.js
echo         RETRY_DELAY: 1000 >> src\config.js
echo     }, >> src\config.js
echo     UI_CONFIG: { >> src\config.js
echo         DEFAULT_THEME: 'dark', >> src\config.js
echo         TOAST_DURATION: 3000, >> src\config.js
echo         MAX_TOASTS: 5 >> src\config.js
echo     } >> src\config.js
echo }; >> src\config.js
echo. >> src\config.js
echo export const SERVER_CONFIG = { >> src\config.js
echo     ip: CONFIG.SERVER.DEFAULT_IP, >> src\config.js
echo     port: CONFIG.SERVER.DEFAULT_PORT, >> src\config.js
echo     timeout: CONFIG.SERVER.DEFAULT_TIMEOUT, >> src\config.js
echo     maxTokens: CONFIG.SERVER.DEFAULT_MAX_TOKENS, >> src\config.js
echo     apiPath: CONFIG.SERVER.DEFAULT_API_PATH, >> src\config.js
echo     get baseUrl() { return `http://${this.ip}:${this.port}`; }, >> src\config.js
echo     get healthEndpoint() { return '/health'; }, >> src\config.js
echo     get modelsEndpoint() { return '/v1/models'; }, >> src\config.js
echo     get chatEndpoint() { return this.apiPath; }, >> src\config.js
echo     get embeddingsEndpoint() { return '/v1/embeddings'; } >> src\config.js
echo }; >> src\config.js
echo. >> src\config.js
echo export function loadServerConfig() { /* ... */ } >> src\config.js
echo export function saveServerConfig() { /* ... */ } >> src\config.js

REM Создание файлов в core
echo // src/core/event-bus.js > src\core\event-bus.js
echo export class EventBus { >> src\core\event-bus.js
echo     constructor() { >> src\core\event-bus.js
echo         this.listeners = new Map(); >> src\core\event-bus.js
echo     } >> src\core\event-bus.js
echo     on(event, callback) { /* ... */ } >> src\core\event-bus.js
echo     off(event, callback) { /* ... */ } >> src\core\event-bus.js
echo     emit(event, data) { /* ... */ } >> src\core\event-bus.js
echo     once(event, callback) { /* ... */ } >> src\core\event-bus.js
echo } >> src\core\event-bus.js

echo // src/core/error-boundary.js > src\core\error-boundary.js
echo export class ErrorBoundary { >> src\core\error-boundary.js
echo     constructor() { /* ... */ } >> src\core\error-boundary.js
echo } >> src\core\error-boundary.js

echo // src/core/storage.js > src\core\storage.js
echo export class Storage { >> src\core\storage.js
echo     static get(key) { /* ... */ } >> src\core\storage.js
echo     static set(key, value) { /* ... */ } >> src\core\storage.js
echo     static remove(key) { /* ... */ } >> src\core\storage.js
echo } >> src\core\storage.js

REM Создание файлов в models
echo // src/models/session-manager.js > src\models\session-manager.js
echo import { CONFIG } from '../config.js'; >> src\models\session-manager.js
echo export class SessionManager { >> src\models\session-manager.js
echo     constructor() { >> src\models\session-manager.js
echo         this.sessions = []; >> src\models\session-manager.js
echo         this.currentId = null; >> src\models\session-manager.js
echo         this.load(); >> src\models\session-manager.js
echo     } >> src\models\session-manager.js
echo     // ... все методы >> src\models\session-manager.js
echo } >> src\models\session-manager.js

echo // src/models/rag-manager.js > src\models\rag-manager.js
echo import { CONFIG } from '../config.js'; >> src\models\rag-manager.js
echo export class RAGManager { >> src\models\rag-manager.js
echo     constructor() { >> src\models\rag-manager.js
echo         this.chunks = []; >> src\models\rag-manager.js
echo         this.embeddings = []; >> src\models\rag-manager.js
echo         this.fileNames = []; >> src\models\rag-manager.js
echo         this.isReady = false; >> src\models\rag-manager.js
echo         this.maxChunks = CONFIG.RAG.MAX_CHUNKS; >> src\models\rag-manager.js
echo     } >> src\models\rag-manager.js
echo     // ... все методы >> src\models\rag-manager.js
echo } >> src\models\rag-manager.js

echo // src/models/assistant-manager.js > src\models\assistant-manager.js
echo export class AssistantManager { >> src\models\assistant-manager.js
echo     constructor() { >> src\models\assistant-manager.js
echo         this.assistants = new Map(); >> src\models\assistant-manager.js
echo         this.activeAssistant = null; >> src\models\assistant-manager.js
echo         this.loadBuiltIn(); >> src\models\assistant-manager.js
echo     } >> src\models\assistant-manager.js
echo     // ... все методы >> src\models\assistant-manager.js
echo } >> src\models\assistant-manager.js

echo // src/models/achievement-manager.js > src\models\achievement-manager.js
echo export class AchievementManager { >> src\models\achievement-manager.js
echo     constructor() { >> src\models\achievement-manager.js
echo         this.achievements = {}; >> src\models\achievement-manager.js
echo         this.load(); >> src\models\achievement-manager.js
echo     } >> src\models\achievement-manager.js
echo     // ... все методы >> src\models\achievement-manager.js
echo } >> src\models\achievement-manager.js

echo // src/models/multi-user-manager.js > src\models\multi-user-manager.js
echo export class MultiUserManager { >> src\models\multi-user-manager.js
echo     constructor() { >> src\models\multi-user-manager.js
echo         this.localUser = null; >> src\models\multi-user-manager.js
echo         this.peers = new Map(); >> src\models\multi-user-manager.js
echo     } >> src\models\multi-user-manager.js
echo     // ... все методы >> src\models\multi-user-manager.js
echo } >> src\models\multi-user-manager.js

echo // src/models/roadmap-tracker.js > src\models\roadmap-tracker.js
echo export class RoadmapTracker { >> src\models\roadmap-tracker.js
echo     constructor() { >> src\models\roadmap-tracker.js
echo         this.milestones = []; >> src\models\roadmap-tracker.js
echo         this.load(); >> src\models\roadmap-tracker.js
echo     } >> src\models\roadmap-tracker.js
echo     // ... все методы >> src\models\roadmap-tracker.js
echo } >> src\models\roadmap-tracker.js

echo // src/models/rate-limiter.js > src\models\rate-limiter.js
echo export class RateLimiter { >> src\models\rate-limiter.js
echo     constructor() { /* ... */ } >> src\models\rate-limiter.js
echo     isAllowed() { /* ... */ } >> src\models\rate-limiter.js
echo } >> src\models\rate-limiter.js

echo // src/models/input-history.js > src\models\input-history.js
echo export class InputHistory { >> src\models\input-history.js
echo     constructor() { /* ... */ } >> src\models\input-history.js
echo     push(text) { /* ... */ } >> src\models\input-history.js
echo     getPrevious() { /* ... */ } >> src\models\input-history.js
echo } >> src\models\input-history.js

echo // src/models/embedding-cache.js > src\models\embedding-cache.js
echo export class EmbeddingCache { >> src\models\embedding-cache.js
echo     constructor() { /* ... */ } >> src\models\embedding-cache.js
echo     async get(hash) { /* ... */ } >> src\models\embedding-cache.js
echo     async set(hash, embedding) { /* ... */ } >> src\models\embedding-cache.js
echo } >> src\models\embedding-cache.js

REM Создание файлов в services
echo // src/services/api-service.js > src\services\api-service.js
echo import { SERVER_CONFIG } from '../config.js'; >> src\services\api-service.js
echo export class ApiService { >> src\services\api-service.js
echo     constructor(eventBus) { >> src\services\api-service.js
echo         this.eventBus = eventBus; >> src\services\api-service.js
echo     } >> src\services\api-service.js
echo     async checkServer() { /* ... */ } >> src\services\api-service.js
echo     async fetchModels() { /* ... */ } >> src\services\api-service.js
echo     async sendMessage(payload) { /* ... */ } >> src\services\api-service.js
echo } >> src\services\api-service.js

echo // src/services/sanitizer.js > src\services\sanitizer.js
echo import { CONFIG } from '../config.js'; >> src\services\sanitizer.js
echo export function sanitizeHTML(str) { >> src\services\sanitizer.js
echo     const div = document.createElement('div'); >> src\services\sanitizer.js
echo     div.textContent = str; >> src\services\sanitizer.js
echo     return div.innerHTML; >> src\services\sanitizer.js
echo } >> src\services\sanitizer.js
echo export function sanitizeText(text) { /* ... */ } >> src\services\sanitizer.js
echo export function validateInput(text) { /* ... */ } >> src\services\sanitizer.js

echo // src/services/syntax-highlighter.js > src\services\syntax-highlighter.js
echo export const SyntaxHighlighter = { >> src\services\syntax-highlighter.js
echo     detectLanguage(code) { /* ... */ }, >> src\services\syntax-highlighter.js
echo     highlight(code, language) { /* ... */ }, >> src\services\syntax-highlighter.js
echo     highlightJS(code) { /* ... */ } >> src\services\syntax-highlighter.js
echo }; >> src\services\syntax-highlighter.js

REM Создание файлов в ui
echo // src/ui/components/toast.js > src\ui\components\toast.js
echo export class ToastManager { >> src\ui\components\toast.js
echo     constructor() { >> src\ui\components\toast.js
echo         this.container = document.createElement('div'); >> src\ui\components\toast.js
echo         this.container.id = 'toast-container'; >> src\ui\components\toast.js
echo         document.body.appendChild(this.container); >> src\ui\components\toast.js
echo     } >> src\ui\components\toast.js
echo     show(msg, type, dur) { /* ... */ } >> src\ui\components\toast.js
echo     success(msg, dur) { this.show(msg, 'success', dur); } >> src\ui\components\toast.js
echo     error(msg, dur) { this.show(msg, 'error', dur); } >> src\ui\components\toast.js
echo     warning(msg, dur) { this.show(msg, 'warning', dur); } >> src\ui\components\toast.js
echo     info(msg, dur) { this.show(msg, 'info', dur); } >> src\ui\components\toast.js
echo } >> src\ui\components\toast.js

echo // src/ui/components/modal.js > src\ui\components\modal.js
echo export class Modal { >> src\ui\components\modal.js
echo     constructor(element) { >> src\ui\components\modal.js
echo         this.element = element; >> src\ui\components\modal.js
echo     } >> src\ui\components\modal.js
echo     open() { /* ... */ } >> src\ui\components\modal.js
echo     close() { /* ... */ } >> src\ui\components\modal.js
echo } >> src\ui\components\modal.js

echo // src/ui/components/virtual-scroll.js > src\ui\components\virtual-scroll.js
echo export class VirtualScroll { >> src\ui\components\virtual-scroll.js
echo     constructor(container, itemHeight) { /* ... */ } >> src\ui\components\virtual-scroll.js
echo     setItems(items) { /* ... */ } >> src\ui\components\virtual-scroll.js
echo     appendItem(item) { /* ... */ } >> src\ui\components\virtual-scroll.js
echo } >> src\ui\components\virtual-scroll.js

echo // src/ui/views/chat-view.js > src\ui\views\chat-view.js
echo export class ChatView { >> src\ui\views\chat-view.js
echo     constructor(app) { >> src\ui\views\chat-view.js
echo         this.app = app; >> src\ui\views\chat-view.js
echo         this.messagesEl = document.getElementById('messages'); >> src\ui\views\chat-view.js
echo         this.userInput = document.getElementById('userInput'); >> src\ui\views\chat-view.js
echo     } >> src\ui\views\chat-view.js
echo     render() { /* ... */ } >> src\ui\views\chat-view.js
echo     addMessage(role, content) { /* ... */ } >> src\ui\views\chat-view.js
echo     async sendMessage() { /* ... */ } >> src\ui\views\chat-view.js
echo } >> src\ui\views\chat-view.js

echo // src/ui/views/sidebar.js > src\ui\views\sidebar.js
echo export class Sidebar { >> src\ui\views\sidebar.js
echo     constructor(app) { >> src\ui\views\sidebar.js
echo         this.app = app; >> src\ui\views\sidebar.js
echo         this.chatList = document.getElementById('chatList'); >> src\ui\views\sidebar.js
echo     } >> src\ui\views\sidebar.js
echo     render() { /* ... */ } >> src\ui\views\sidebar.js
echo } >> src\ui\views\sidebar.js

echo // src/ui/views/settings-view.js > src\ui\views\settings-view.js
echo export class SettingsView { >> src\ui\views\settings-view.js
echo     constructor() { /* ... */ } >> src\ui\views\settings-view.js
echo     open() { /* ... */ } >> src\ui\views\settings-view.js
echo     close() { /* ... */ } >> src\ui\views\settings-view.js
echo } >> src\ui\views\settings-view.js

echo // src/ui/views/info-view.js > src\ui\views\info-view.js
echo export class InfoView { >> src\ui\views\info-view.js
echo     constructor() { /* ... */ } >> src\ui\views\info-view.js
echo     open(tab) { /* ... */ } >> src\ui\views\info-view.js
echo } >> src\ui\views\info-view.js

echo // src/ui/views/share-view.js > src\ui\views\share-view.js
echo export class ShareView { >> src\ui\views\share-view.js
echo     constructor() { /* ... */ } >> src\ui\views\share-view.js
echo     open() { /* ... */ } >> src\ui\views\share-view.js
echo } >> src\ui\views\share-view.js

echo // src/ui/views/game-view.js > src\ui\views\game-view.js
echo export class GameView { >> src\ui\views\game-view.js
echo     constructor() { /* ... */ } >> src\ui\views\game-view.js
echo     open() { /* ... */ } >> src\ui\views\game-view.js
echo } >> src\ui\views\game-view.js

echo // src/ui/views/export-view.js > src\ui\views\export-view.js
echo export class ExportView { >> src\ui\views\export-view.js
echo     constructor() { /* ... */ } >> src\ui\views\export-view.js
echo     open() { /* ... */ } >> src\ui\views\export-view.js
echo } >> src\ui\views\export-view.js

echo // src/ui/renderers/message-renderer.js > src\ui\renderers\message-renderer.js
echo import { sanitizeHTML } from '../../services/sanitizer.js'; >> src\ui\renderers\message-renderer.js
echo import { SyntaxHighlighter } from '../../services/syntax-highlighter.js'; >> src\ui\renderers\message-renderer.js
echo export class MessageRenderer { >> src\ui\renderers\message-renderer.js
echo     render(msgData) { /* ... */ } >> src\ui\renderers\message-renderer.js
echo     renderLabel(role) { /* ... */ } >> src\ui\renderers\message-renderer.js
echo     renderBubble(role, content) { /* ... */ } >> src\ui\renderers\message-renderer.js
echo     formatMessage(content) { /* ... */ } >> src\ui\renderers\message-renderer.js
echo } >> src\ui\renderers\message-renderer.js

echo // src/ui/theme.js > src\ui\theme.js
echo export function applyTheme(theme) { >> src\ui\theme.js
echo     document.documentElement.setAttribute('data-theme', theme); >> src\ui\theme.js
echo     localStorage.setItem('chat_theme', theme); >> src\ui\theme.js
echo } >> src\ui\theme.js
echo export function cycleTheme(themes) { /* ... */ } >> src\ui\theme.js

REM Создание файлов в games
echo // src/games/game-2048.js > src\games\game-2048.js
echo export class Game2048 { >> src\games\game-2048.js
echo     constructor(container, size = 4) { >> src\games\game-2048.js
echo         this.c = container; >> src\games\game-2048.js
echo         this.size = size; >> src\games\game-2048.js
echo         this.grid = []; >> src\games\game-2048.js
echo         this.score = 0; >> src\games\game-2048.js
echo         this.init(); >> src\games\game-2048.js
echo     } >> src\games\game-2048.js
echo     init() { /* ... */ } >> src\games\game-2048.js
echo     render() { /* ... */ } >> src\games\game-2048.js
echo     move(direction) { /* ... */ } >> src\games\game-2048.js
echo } >> src\games\game-2048.js

echo // src/games/snake-game.js > src\games\snake-game.js
echo export class SnakeGame { >> src\games\snake-game.js
echo     constructor(container) { >> src\games\snake-game.js
echo         this.c = container; >> src\games\snake-game.js
echo         this.canvas = document.createElement('canvas'); >> src\games\snake-game.js
echo         this.c.appendChild(this.canvas); >> src\games\snake-game.js
echo         this.init(); >> src\games\snake-game.js
echo     } >> src\games\snake-game.js
echo     init() { /* ... */ } >> src\games\snake-game.js
echo     update() { /* ... */ } >> src\games\snake-game.js
echo     render() { /* ... */ } >> src\games\snake-game.js
echo } >> src\games\snake-game.js

echo // src/games/tetris-game.js > src\games\tetris-game.js
echo export class TetrisGame { >> src\games\tetris-game.js
echo     constructor(container) { >> src\games\tetris-game.js
echo         this.c = container; >> src\games\tetris-game.js
echo         this.canvas = document.createElement('canvas'); >> src\games\tetris-game.js
echo         this.c.appendChild(this.canvas); >> src\games\tetris-game.js
echo         this.init(); >> src\games\tetris-game.js
echo     } >> src\games\tetris-game.js
echo     init() { /* ... */ } >> src\games\tetris-game.js
echo     update() { /* ... */ } >> src\games\tetris-game.js
echo     render() { /* ... */ } >> src\games\tetris-game.js
echo } >> src\games\tetris-game.js

REM Создание файлов в utils
echo // src/utils/dom-helpers.js > src\utils\dom-helpers.js
echo export function createSafeElement(tag, attributes, textContent) { >> src\utils\dom-helpers.js
echo     const element = document.createElement(tag); >> src\utils\dom-helpers.js
echo     // ... >> src\utils\dom-helpers.js
echo     return element; >> src\utils\dom-helpers.js
echo } >> src\utils\dom-helpers.js
echo export function setTextContent(element, text) { /* ... */ } >> src\utils\dom-helpers.js

echo // src/utils/file-helpers.js > src\utils\file-helpers.js
echo export function getFileText(file) { >> src\utils\file-helpers.js
echo     return new Promise((resolve, reject) => { >> src\utils\file-helpers.js
echo         const reader = new FileReader(); >> src\utils\file-helpers.js
echo         reader.onload = () => resolve(reader.result); >> src\utils\file-helpers.js
echo         reader.onerror = reject; >> src\utils\file-helpers.js
echo         reader.readAsText(file); >> src\utils\file-helpers.js
echo     }); >> src\utils\file-helpers.js
echo } >> src\utils\file-helpers.js
echo export function isFileAllowed(file) { /* ... */ } >> src\utils\file-helpers.js

echo // src/utils/string-helpers.js > src\utils\string-helpers.js
echo export function truncateText(text, maxLength) { >> src\utils\string-helpers.js
echo     if (text.length <= maxLength) return text; >> src\utils\string-helpers.js
echo     return text.substring(0, maxLength) + '...'; >> src\utils\string-helpers.js
echo } >> src\utils\string-helpers.js

echo // src/utils/network-helpers.js > src\utils\network-helpers.js
echo import { CONFIG } from '../config.js'; >> src\utils\network-helpers.js
echo export async function fetchWithRetry(url, options = {}, retries = CONFIG.RETRIES.MAX_RETRIES) { >> src\utils\network-helpers.js
echo     // ... >> src\utils\network-helpers.js
echo } >> src\utils\network-helpers.js

echo // src/utils/test-runner.js > src\utils\test-runner.js
echo export class TestRunner { >> src\utils\test-runner.js
echo     constructor() { >> src\utils\test-runner.js
echo         this.tests = []; >> src\utils\test-runner.js
echo         this.results = []; >> src\utils\test-runner.js
echo     } >> src\utils\test-runner.js
echo     addTest(name, fn) { /* ... */ } >> src\utils\test-runner.js
echo     async runAll() { /* ... */ } >> src\utils\test-runner.js
echo     render() { /* ... */ } >> src\utils\test-runner.js
echo } >> src\utils\test-runner.js

REM Создание файлов в styles
echo /* src/styles/main.css */ > src\styles\main.css
echo :root { >> src\styles\main.css
echo     --bg-primary: #1a1a2e; >> src\styles\main.css
echo     --bg-secondary: #16213e; >> src\styles\main.css
echo     --text-primary: #e0e0e0; >> src\styles\main.css
echo     /* ... остальные переменные */ >> src\styles\main.css
echo } >> src\styles\main.css
echo body { font-family: 'Segoe UI', sans-serif; } >> src\styles\main.css

echo /* src/styles/themes.css */ > src\styles\themes.css
echo [data-theme="light"] { /* ... */ } >> src\styles\themes.css
echo [data-theme="monokai"] { /* ... */ } >> src\styles\themes.css

echo /* src/styles/sidebar.css */ > src\styles\sidebar.css
echo .sidebar { /* ... */ } >> src\styles\sidebar.css

echo /* src/styles/chat.css */ > src\styles\chat.css
echo .chat-messages { /* ... */ } >> src\styles\chat.css
echo .message { /* ... */ } >> src\styles\chat.css

echo /* src/styles/modals.css */ > src\styles\modals.css
echo .modal-overlay { /* ... */ } >> src\styles\modals.css
echo .modal-content { /* ... */ } >> src\styles\modals.css

echo /* src/styles/games.css */ > src\styles\games.css
echo .game-selector { /* ... */ } >> src\styles\games.css

REM Создание тестов
mkdir tests 2>nul
echo // tests/rag-manager.test.js > tests\rag-manager.test.js
echo import { RAGManager } from '../src/models/rag-manager.js'; >> tests\rag-manager.test.js
echo describe('RAGManager', () => { /* ... */ }); >> tests\rag-manager.test.js

echo // tests/session-manager.test.js > tests\session-manager.test.js
echo import { SessionManager } from '../src/models/session-manager.js'; >> tests\session-manager.test.js
echo describe('SessionManager', () => { /* ... */ }); >> tests\session-manager.test.js

echo.
echo Структура проекта успешно создана!
echo.
echo Структура каталогов:
echo infocom-lm-chat/
echo ├── index.html
echo ├── src/
echo │   ├── app.js
echo │   ├── config.js
echo │   ├── core/
echo │   │   ├── event-bus.js
echo │   │   ├── error-boundary.js
echo │   │   └── storage.js
echo │   ├── models/
echo │   │   ├── session-manager.js
echo │   │   ├── rag-manager.js
echo │   │   ├── assistant-manager.js
echo │   │   ├── achievement-manager.js
echo │   │   ├── multi-user-manager.js
echo │   │   ├── roadmap-tracker.js
echo │   │   ├── rate-limiter.js
echo │   │   ├── input-history.js
echo │   │   └── embedding-cache.js
echo │   ├── services/
echo │   │   ├── api-service.js
echo │   │   ├── sanitizer.js
echo │   │   └── syntax-highlighter.js
echo │   ├── ui/
echo │   │   ├── components/
echo │   │   │   ├── toast.js
echo │   │   │   ├── modal.js
echo │   │   │   └── virtual-scroll.js
echo │   │   ├── views/
echo │   │   │   ├── chat-view.js
echo │   │   │   ├── sidebar.js
echo │   │   │   ├── settings-view.js
echo │   │   │   ├── info-view.js
echo │   │   │   ├── share-view.js
echo │   │   │   ├── game-view.js
echo │   │   │   └── export-view.js
echo │   │   ├── renderers/
echo │   │   │   └── message-renderer.js
echo │   │   └── theme.js
echo │   ├── games/
echo │   │   ├── game-2048.js
echo │   │   ├── snake-game.js
echo │   │   └── tetris-game.js
echo │   ├── utils/
echo │   │   ├── dom-helpers.js
echo │   │   ├── file-helpers.js
echo │   │   ├── string-helpers.js
echo │   │   ├── network-helpers.js
echo │   │   └── test-runner.js
echo │   └── styles/
echo │       ├── main.cssecho │       ├── themes.css
echo │       ├── sidebar.css
echo │       ├── chat.css
echo │       ├── modals.css
echo │       └── games.css
echo └── tests/
echo     ├── rag-manager.test.js
echo     └── session-manager.test.js

pause