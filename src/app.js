// src/app.js
import { CONFIG, SERVER_CONFIG, loadServerConfig, saveServerConfig } from './config.js';
import { EventBus } from './core/event-bus.js';
import { ErrorBoundary } from './core/error-boundary.js';
import { ToastManager } from './ui/components/toast.js';
import { SessionManager } from './models/session-manager.js';
import { RAGManager } from './models/rag-manager.js';
import { AssistantManager } from './models/assistant-manager.js';
import { AchievementManager } from './models/achievement-manager.js';
import { MultiUserManager } from './models/multi-user-manager.js';
import { RoadmapTracker } from './models/roadmap-tracker.js';
import { RateLimiter } from './models/rate-limiter.js';
import { InputHistory } from './models/input-history.js';
import { ApiService } from './services/api-service.js';
import { applyTheme, cycleTheme } from './ui/theme.js';
import { ChatView } from './ui/views/chat-view.js';
import { Sidebar } from './ui/views/sidebar.js';
import { SettingsView } from './ui/views/settings-view.js';
import { InfoView } from './ui/views/info-view.js';
import { ShareView } from './ui/views/share-view.js';
import { GameView } from './ui/views/game-view.js';
import { ExportView } from './ui/views/export-view.js';
import { renderAssistantBar, updateActiveIndicator, viewPrompt, deleteAssistant, openCustomAssistantModal } from './ui/views/assistant-bar.js';
import { runAllTests } from './utils/test-runner.js';

class App {
    constructor() {
        // Инициализация ядра
        this.eventBus = new EventBus();
        this.toast = new ToastManager();
        this.errorBoundary = new ErrorBoundary();
        this.rateLimiter = new RateLimiter();
        this.inputHistory = new InputHistory();

        // Инициализация моделей
        this.sessionManager = new SessionManager(this.eventBus);
        this.ragManager = new RAGManager(this.eventBus);
        this.assistantManager = new AssistantManager(this.eventBus);
        this.achievementManager = new AchievementManager(this.eventBus);
        this.multiUserManager = new MultiUserManager(this.eventBus);
        this.roadmapTracker = new RoadmapTracker(this.eventBus);

        // Инициализация сервисов
        this.apiService = new ApiService(this.eventBus);

        // Состояние приложения
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
        this.availableModels = [];
        this.isProcessing = false;
        this.streamAbortController = null;
        this.attachedFiles = [];
        this.currentTheme = localStorage.getItem('chat_theme') || CONFIG.UI_CONFIG.DEFAULT_THEME;
        this.replyTarget = null;
        this.editingMessageId = null;
        this.editingOriginalContent = '';
        this.lastBotMessageEl = null;
        this.lastBotContent = '';
        this.fullResponse = '';
        this.currentDragMode = 'rag';

        // Инициализация UI
        this.chatView = new ChatView(this);
        this.sidebar = new Sidebar(this);
        this.settingsView = new SettingsView(this);
        this.infoView = new InfoView(this);
        this.shareView = new ShareView(this);
        this.gameView = new GameView(this);
        this.exportView = new ExportView(this);

        // Загрузка и инициализация
        this.init();
    }

    async init() {
        // Загрузка конфигурации сервера
        loadServerConfig();

        // Применение темы
        applyTheme(this.currentTheme);

        // Загрузка данных RAG
        const ragData = this.sessionManager.getRAG();
        if (ragData) {
            try {
                this.ragManager.fromJSON(ragData);
                if (this.ragManager.isReady) {
                    this.updateRagFilesUI();
                }
            } catch (e) {
                console.warn('Не смогли загрузить данные для RAG:', e);
            }
        }

        // Загрузка модели для текущего чата
        const model = this.sessionManager.getModelForChat();
        if (model) {
            this.currentModel = model;
            this.updateModelUI();
        }

        // Проверка сервера
        await this.apiService.checkServer();

        // Рендеринг UI
        this.sidebar.render();
        this.chatView.render();
        this.renderAssistantBar();
        this.roadmapTracker.render();
        this.updateStats();
        this.multiUserManager.renderUsers();
        this.multiUserManager.startSimulation();

        // Фокус на поле ввода
        this.chatView.focusInput();

        // Обновление счетчика символов
        this.chatView.updateCharCounter();

        // Инициализация выбора режима
        this.selectDragMode('rag');

        // Автозапуск тестов
        setTimeout(() => {
            runAllTests();
        }, 500);

        // Применение подсветки после загрузки
        setTimeout(() => {
            document.querySelectorAll('.message .bubble pre code').forEach(el => {
                if (!el.classList.contains('hljs')) {
                    const code = el.textContent;
                    const lang = el.className.replace('language-', '') || 'text';
                    // Подсветка будет применена при рендеринге
                }
            });
        }, 500);

        // Настройка периодических задач
        setInterval(() => this.apiService.checkServer(), CONFIG.SERVER.CHECK_INTERVAL);
        setInterval(() => this.updateStats(), CONFIG.DEBOUNCE.STATS);

        // Подписка на события
        this.setupEventListeners();

        this.toast.info(`🚀 Infocom LM Chat Pro v${CONFIG.VERSION}`, 2000);
        this.toast.info('💡 Используйте Ctrl+↑ и Ctrl+↓ для истории сообщений', 3000);
        this.toast.info('🚀 v5.0 — Multi-user, кастомные ассистенты, тесты!', 3000);

        console.log(`✅ Infocom LM Chat Pro v${CONFIG.VERSION}`);
        console.log('🛡️ XSS-защита: активна');
        console.log('♿ Доступность: ARIA + клавиатура');
        console.log('⚡ EventBus: активен');
    }

    setupEventListeners() {
        // Глобальные обработчики клавиш
        document.addEventListener('keydown', this.handleGlobalKeys.bind(this));

        // События от менеджеров
        this.eventBus.on('session:switched', () => {
            this.sidebar.render();
            this.chatView.loadMessages();
            this.updateStats();
            this.updateRagFilesUI();
        });

        this.eventBus.on('rag:updated', () => {
            this.updateRagFilesUI();
            this.updateStats();
        });

        this.eventBus.on('rag:cleared', () => {
            this.updateRagFilesUI();
            this.updateStats();
        });

        this.eventBus.on('achievement:unlocked', (ach) => {
            this.showAchievement(ach);
            this.updateStats();
        });

        this.eventBus.on('server:connected', () => {
            console.log('✅ Сервер подключен');
        });

        this.eventBus.on('server:disconnected', () => {
            console.warn('❌ Сервер недоступен');
        });

        this.eventBus.on('theme:changed', (theme) => {
            this.currentTheme = theme;
        });
    }

    handleGlobalKeys(e) {
        // Фокус на поле ввода при нажатии "/"
        const userInput = document.getElementById('userInput');
        if (e.key === '/' && document.activeElement !== userInput && !document.querySelector('.modal-overlay.active')) {
            e.preventDefault();
            userInput.focus();
        }

        // Закрытие модальных окон по Escape
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
            });
            if (this.replyTarget) {
                this.clearReplyTarget();
            }
        }

        // Ctrl+S для открытия шаринга
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.shareView.open();
        }

        // Ctrl+W для открытия Вики
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
            e.preventDefault();
            const infoModal = document.getElementById('infoModal');
            if (infoModal && infoModal.classList.contains('active')) {
                infoModal.classList.remove('active');
                infoModal.setAttribute('aria-hidden', 'true');
            } else {
                this.infoView.open('wiki');
            }
        }

        // Ctrl+E для экспорта
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            this.exportView.open();
        }
    }

    // ===== UI Update Methods =====

    updateModelUI() {
        const currentModelLabel = document.getElementById('currentModelLabel');
        if (currentModelLabel) {
            const display = this.currentModel.length > 40 ? 
                this.currentModel.substring(0, 37) + '...' : 
                this.currentModel;
            currentModelLabel.textContent = `Модель: ${display}`;
        }
    }

    updateStats() {
        const messagesCount = this.sessionManager.getMessages()
            .filter(m => m.role !== 'system').length;
        const statMessages = document.getElementById('statMessages');
        const statFiles = document.getElementById('statFiles');
        const statRagChunks = document.getElementById('statRagChunks');
        const statRagStatus = document.getElementById('statRagStatus');
        const statAchievements = document.getElementById('statAchievements');
        const ragProgressFill = document.getElementById('ragProgressFill');

        if (statMessages) statMessages.textContent = messagesCount;
        if (statFiles) statFiles.textContent = this.attachedFiles.length;

        const chunkCount = this.ragManager.chunkCount;
        const maxChunks = this.ragManager.maxChunks;
        if (statRagChunks) statRagChunks.textContent = `${chunkCount} / ${maxChunks}`;

        const usage = this.ragManager.usagePercent;
        const progressPercent = Math.min(usage, 100);
        if (ragProgressFill) ragProgressFill.style.width = `${progressPercent}%`;

        if (statRagStatus) {
            if (!this.ragManager.isReady) {
                statRagStatus.textContent = 'Не активен';
                statRagStatus.className = 'stat-value rag-status inactive';
                if (ragProgressFill) ragProgressFill.className = 'rag-progress-fill';
            } else if (chunkCount >= maxChunks) {
                statRagStatus.textContent = '🔴 Полон';
                statRagStatus.className = 'stat-value rag-status full';
                if (ragProgressFill) ragProgressFill.className = 'rag-progress-fill full';
            } else if (usage >= 90) {
                statRagStatus.textContent = '🟠 Почти полон';
                statRagStatus.className = 'stat-value rag-status warning';
                if (ragProgressFill) ragProgressFill.className = 'rag-progress-fill warning';
                if (usage >= 95) {
                    this.toast.warning(`⚠️ RAG почти заполнен (${Math.round(usage)}%)`, 4000);
                }
            } else {
                statRagStatus.textContent = '🟢 Активен';
                statRagStatus.className = 'stat-value rag-status active';
                if (ragProgressFill) ragProgressFill.className = 'rag-progress-fill active';
            }
        }

        if (statAchievements) {
            statAchievements.textContent = this.achievementManager.unlockedCount || 0;
        }
    }

    updateRagFilesUI() {
        const files = this.ragManager.getFileNames();
        const ragFilesInfo = document.getElementById('ragFilesInfo');
        const ragFileList = document.getElementById('ragFileList');
        
        if (files && files.length) {
            if (ragFilesInfo) ragFilesInfo.style.display = 'flex';
            if (ragFileList) {
                ragFileList.innerHTML = files.map(n => 
                    `<span class="rag-file-tag">📚 ${this.sanitizeHTML(n)}</span>`
                ).join('');
            }
        } else {
            if (ragFilesInfo) ragFilesInfo.style.display = 'none';
        }
        this.updateStats();
    }

    updateAttachedFilesUI() {
        const fileInfo = document.getElementById('fileInfo');
        const fileList = document.getElementById('fileList');
        
        if (this.attachedFiles.length) {
            if (fileInfo) fileInfo.style.display = 'flex';
            if (fileList) {
                fileList.innerHTML = this.attachedFiles.map((f, i) =>
                    `<span class="file-tag">📎 ${f.name} (${(f.size/1024).toFixed(1)} KB) <button class="remove-file" data-i="${i}">✕</button></span>`
                ).join('');
                fileList.querySelectorAll('.remove-file').forEach(btn => {
                    btn.onclick = () => {
                        const idx = parseInt(btn.dataset.i);
                        this.attachedFiles.splice(idx, 1);
                        this.updateAttachedFilesUI();
                        this.updateStats();
                    };
                });
            }
        } else {
            if (fileInfo) fileInfo.style.display = 'none';
        }
        this.updateStats();
    }

    renderAssistantBar() {
        renderAssistantBar(this);
    }

    updateActiveIndicator() {
        updateActiveIndicator(this);
    }

    // ===== Reply Target =====

    setReplyTarget(div, content, role) {
        document.querySelectorAll('.message.reply-target').forEach(el => {
            el.classList.remove('reply-target');
        });
        div.classList.add('reply-target');
        this.replyTarget = { div, content, role };
        
        const author = role === 'user' ? 'Вы' : 'Infocom_LM_Chat';
        const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.placeholder = `↩️ Ответ ${author}: ${preview} (Ctrl+Enter для отправки)`;
            userInput.focus();
        }
        this.toast.info(`↩️ Ответ на сообщение от ${author}`, 2000);
    }

    clearReplyTarget() {
        this.replyTarget = null;
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.placeholder = 'Введите вопрос или код... (Ctrl+Enter для отправки)';
        }
        document.querySelectorAll('.message.reply-target').forEach(el => {
            el.classList.remove('reply-target');
        });
    }

    // ===== Drag Mode =====

    selectDragMode(mode) {
        this.currentDragMode = mode;
        const dragIcon = document.getElementById('dragIcon');
        const dragModeIndicator = document.getElementById('dragModeIndicator');
        
        document.querySelectorAll('#dragModeSelector label').forEach(label => {
            label.classList.toggle('selected', label.dataset.mode === mode);
        });

        if (mode === 'attachment') {
            if (dragIcon) dragIcon.textContent = '📎';
            if (dragModeIndicator) dragModeIndicator.textContent = 'Режим: Вложение';
        } else {
            if (dragIcon) dragIcon.textContent = '📚';
            if (dragModeIndicator) dragModeIndicator.textContent = 'Режим: RAG документ';
        }
    }

    // ===== Achievement =====

    showAchievement(ach) {
        const div = document.createElement('div');
        div.className = 'achievement-unlock';
        div.setAttribute('role', 'status');
        div.innerHTML = `
            <div style="display:flex;align-items:center; gap:12px;">
                <span class="icon">🏆</span>
                <div>
                    <div class="title">${this.sanitizeHTML(ach.name)}</div>
                    <div class="desc">${this.sanitizeHTML(ach.desc)}</div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        
        setTimeout(() => {
            div.style.animation = 'fadeOut 0.5s ease';
            setTimeout(() => div.remove(), 500);
        }, 4000);
        
        this.toast.success(`🏆 Достижение: ${ach.name}`, 3000);
        this.updateStats();
    }

    // ===== Utilities =====

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    getFileText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    isFileAllowed(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (CONFIG.SECURITY.ALLOWED_EXTENSIONS.includes(ext)) return true;
        if (file.type.startsWith('text/')) return true;
        return false;
    }

    validateInput(text) {
        if (!text) return { valid: false, reason: 'Пустой ввод' };
        if (text.length > CONFIG.LIMITS.MAX_INPUT_LENGTH) {
            return { valid: false, reason: `Превышен лимит ${CONFIG.LIMITS.MAX_INPUT_LENGTH} символов` };
        }
        const dangerous = ['--', '; DROP', '; DELETE', 'UNION SELECT'];
        for (const d of dangerous) {
            if (text.toUpperCase().includes(d)) {
                return { valid: false, reason: 'Обнаружена потенциально опасная конструкция' };
            }
        }
        return { valid: true };
    }

    validateLength(text) {
        return text.length <= CONFIG.LIMITS.MAX_INPUT_LENGTH;
    }
}

// Запуск приложения
const app = new App();
window.app = app; // Для доступа из консоли (отладка)

export default app;