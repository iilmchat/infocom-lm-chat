// src/app.js
/**
 * Главный файл приложения Infocom LM Chat Pro v5.2
 * 
 * Архитектура:
 * - Используется EventBus для слабосвязанной коммуникации между модулями
 * - Все компоненты инициализируются в конструкторе App
 * - Приложение запускается автоматически при загрузке страницы
 * - Поддерживается восстановление сессии из localStorage
 * 
 * Изменено в 5.1:
 * - Добавлена аутентификация через AuthService
 * - Добавлен менеджер уведомлений NotificationManager
 * - Добавлена аналитика AnalyticsView
 * - Улучшена обработка ошибок
 * - Добавлена поддержка приватных чатов и общих комнат
  * Изменено в 5.2:
 * - Добавлена поддержка Markdown через markdownService
 * - Удалён самописный syntaxHighlighter, используется highlight.js (подключается глобально)
 * - Добавлена поддержка DOCX через file-helpers
 * - Расширенный поиск в админ-панели (интеграция с AdminPanel)
 * - Отображение пользователей в комнате (админка) 
 */
/* Изменено в 5.3 — замена модальных окон на ProfileModal */
/**
 * Главный файл приложения Infocom LM Chat Pro v6.0
 * Изменено в 6.0:
 * - Добавлен SPA-роутер (Router)
 * - Разделение на модули (чат, админка, игры, профиль)
 * - Динамическая загрузка модулей через import()
 * - Контейнеры для каждого раздела
 * - Переходы через роутер вместо модальных окон
 * - Добавлен ChatModule для управления основным чатом
 */

import { CONFIG, SERVER_CONFIG, loadServerConfig, saveServerConfig } from './config.js';
import { EventBus } from './core/event-bus.js';
import { ErrorBoundary } from './core/error-boundary.js';
import { ToastManager } from './ui/components/toast.js';
/* Добавлено в 6.1: импорт AvatarService */
import { AvatarService } from './services/avatar-service.js';
import { SessionManager } from './models/session-manager.js';
import { RAGManager } from './models/rag-manager.js';
import { AssistantManager } from './models/assistant-manager.js';
import { AchievementManager } from './models/achievement-manager.js';
import { MultiUserManager } from './models/multi-user-manager.js';
import { RoadmapTracker } from './models/roadmap-tracker.js';
import { RateLimiter } from './models/rate-limiter.js';
import { InputHistory } from './models/input-history.js';
import { ApiService } from './services/api-service.js';
import { ChatApiClient } from './services/http-client.js';
 // Добавлено в 5.1.
import { AuthService } from './services/auth-service.js';
 // Добавлено в 5.1.
import { NotificationManager } from './models/notification-manager.js';
// Добавлено в 5.2: сервис Markdown
import { markdownService } from './services/markdown-service.js';

import { applyTheme, cycleTheme } from './ui/theme.js';
//import { ChatView } from './ui/views/chat-view.js';
//import { Sidebar } from './ui/views/sidebar.js';

// Изменено в 6.0: импорт ChatModule вместо прямых ChatView и Sidebar
import { ChatModule } from './modules/chat/ChatModule.js';
import { SettingsView } from './ui/views/settings-view.js';
import { InfoView } from './ui/views/info-view.js';
import { ShareView } from './ui/views/share-view.js';
// Удалено в 6.0: импорт GameView (теперь динамический)
//import { GameView } from './ui/views/game-view.js';
import { ExportView } from './ui/views/export-view.js';
 // Добавлено в 5.1.
import { AnalyticsView } from './ui/views/analytics-view.js';
import { renderAssistantBar, updateActiveIndicator, viewPrompt, deleteAssistant, openCustomAssistantModal } from './ui/views/assistant-bar.js';
import { runAllTests } from './utils/test-runner.js';
import { DropZone } from './ui/components/drop-zone.js';
import sectionToggle from './ui/components/section-toggle.js';
import { SectionHelpers } from './utils/section-helpers.js';
// 5.3 Удалены импорты AuthModal и UserModal
//import { UserModal } from './ui/views/user-modal.js';
// Удалено в 6.0: импорт AdminPanel и GameView (теперь динамические)
//import { AdminPanel } from './ui/views/admin-panel.js';
import { PrivateChat } from './ui/views/private-chat.js';
// 5.3 Удалены импорты AuthModal и UserModal
//import { AuthModal } from './ui/views/auth-modal.js'; // Добавлено в 5.1.
import { ProfileModal } from './ui/views/profile-modal.js';   /* Добавлено в 5.3 */
import { Router } from './core/router.js'; /* Добавлено в 6.0 */

// Добавлено в 6.0: импорт модулей
// Добавлено в 6.0: для динамической загрузки AdminModule, GamesModule, ProfileModule
// они будут импортироваться через import() в методах showAdmin, showGames, showProfile
import { PrivateChatModule } from './modules/private/PrivateChatModule.js';

/* Добавлено в 6.1: импорт новых модулей */
import { SettingsModule } from './modules/settings/SettingsModule.js';
import { StatsModule } from './modules/stats/StatsModule.js';

import { i18n } from './services/i18n.js';

// 5.3 Удалены импорты AuthModal и UserModal

// Удалено в 5.2: импорт syntaxHighlighter и связанных модулей
// import { syntaxHighlighter } from './services/syntax-highlighter.js';
// import './services/syntax-highlighter-optimizations.js';

// Удалено в 6.0: импорт AdminPanel и GameView (теперь динамические)
// import { AdminPanel } from './ui/views/admin-panel.js';
// import { GameView } from './ui/views/game-view.js';

/**
 * Главный класс приложения
 * Координирует работу всех компонентов и управляет глобальным состоянием
 */
class App {
    constructor() {
        // ===== Инициализация ядра =====
        // Центральная шина событий для коммуникации между модулями
        this.eventBus = new EventBus();
        
        // Менеджер всплывающих уведомлений (Toast)
        this.toast = new ToastManager();
        
        // Глобальный перехватчик ошибок с красивым отображением
        this.errorBoundary = new ErrorBoundary();
        
        // Ограничитель частоты запросов (защита от спама)
        this.rateLimiter = new RateLimiter();
        
        // История ввода сообщений (Ctrl+↑/↓)
        this.inputHistory = new InputHistory();
        // Локализация
        this.i18n = i18n;

        // ===== Инициализация сервисов =====
        /* Добавлено в 6.1: создание AvatarService */
        this.avatarService = new AvatarService();        
        
        // Сервис для работы с API
        this.apiService = new ChatApiClient(this.eventBus);
        // Сервис для работы с API проверки статуса сервера
        this.api = new ApiService(this.eventBus);

        // Добавлено в 5.1: Сервис аутентификации и управления сессиями
        this.authService = new AuthService(this.eventBus);
        // Добавлено в 5.2: сервис Markdown
        this.markdownService = markdownService;

        // ===== Инициализация моделей =====
        // Управление диалогами (сессиями чата)
        this.sessionManager = new SessionManager(this.eventBus);
        
        // Управление RAG документами (Retrieval-Augmented Generation)
        this.ragManager = new RAGManager(this.eventBus);
        
        // Управление ассистентами (встроенными и кастомными)
        this.assistantManager = new AssistantManager(this.eventBus);
        
        // Управление достижениями (геймификация)
        this.achievementManager = new AchievementManager(this.eventBus);
        
        // Управление многопользовательским режимом (общие комнаты, приватные чаты)
        this.multiUserManager = new MultiUserManager(this);
        
        // Отслеживание прогресса развития проекта (дорожная карта)
        this.roadmapTracker = new RoadmapTracker(this.eventBus);

        // Добавлено в 5.1: Управление уведомлениями
        this.notificationManager = new NotificationManager(this);        

        // ===== Состояние приложения =====
        // Текущая модель для генерации ответов
        this.currentModel = CONFIG.UI_CONFIG.DEFAULT_MODEL;
        
        // Список доступных моделей (загружается с сервера)
        this.availableModels = [];
        
        // Флаг обработки запроса (блокировка повторных отправок)
        this.isProcessing = false;
        
        // Контроллер для отмены потоковых запросов
        this.streamAbortController = null;
        
        // Прикреплённые файлы к сообщению
        this.attachedFiles = [];
        
        // Текущая тема оформления
        this.currentTheme = localStorage.getItem('chat_theme') || CONFIG.UI_CONFIG.DEFAULT_THEME;
        
        // Цель для ответа на сообщение (reply)
        this.replyTarget = null;
        
        // ID редактируемого сообщения
        this.editingMessageId = null;
        
        // Оригинальное содержимое редактируемого сообщения
        this.editingOriginalContent = '';
        
        // Элемент последнего сообщения бота (для стриминга)
        this.lastBotMessageEl = null;
        this.lastBotContent = '';
        this.fullResponse = '';
        
        // Режим Drag-and-Drop (attachment или rag)
        this.currentDragMode = 'rag';

        // ===== Модули (загружаются динамически) =====

  
        
        this.adminLoaded = false;
        this.gamesLoaded = false;
        this.profileLoaded = false;
        this.adminModule = null;      // Изменено в 6.0
        this.gamesModule = null;      // Изменено в 6.0
        this.profileModule = null;    // Изменено в 6.0
        // Добавлено в 6.0: импорт модулей privateChatModule              
        this.privateChatModule = null;                
        /* Добавлено в 6.1: создание модулей настроек и статистики (ленивая загрузка) */
        this.settingsModule = null;
        this.statsModule = null;

        // ===== Инициализация UI (постоянные модули) =====
        // Изменено в 6.0: создание ChatModule вместо прямых ChatView и Sidebar
        this.chatModule = new ChatModule(this);
        // Получаем ссылки для обратной совместимости (чтобы не ломать старый код)
        this.chatView = this.chatModule.chatView;
        this.sidebar = this.chatModule.sidebar;
        
        // Настройки сервера
        this.settingsView = new SettingsView(this);
        
        // Информационное окно (Вики, Предложения, Достижения)
        this.infoView = new InfoView(this);
        
        // Окно для совместного доступа (Share)
        this.shareView = new ShareView(this);
        
        //Удалено в 6.0: Игры
        //this.gameView = new GameView(this);
        
        // Экспорт диалогов
        this.exportView = new ExportView(this);

        // Добавлено в 5.1: Аналитика
        this.analyticsView = new AnalyticsView(this);

        // Модальное окно профиля пользователя // Удалено 5.3
        // this.userModal = new UserModal(this);  // Удалено 5.3
        
        // Удалено в 6.0: панель администратора создаётся динамически в AdminModule
        // this.adminPanel = new AdminPanel(this);
        
        // Приватные чаты (старый модальный вариант, оставляем для совместимости)
        this.privateChat = new PrivateChat(this);

        // Добавлено в 5.1: Модальное окно аутентификации // Удалено 5.3
        // this.authModal = new AuthModal(this);  // Удалено 5.3

        // Модальное (общее) окно профиля пользователя
        /* Добавлено в 5.3 */
        this.profileModal = new ProfileModal(this);   
   

        // Добавлено в 5.1: Инициализация сервиса аутентификации и модального окна
        // Обработчик входа   
        // Удалено 5.3
        /*     
        this.authModal.onLogin = (user) => {
            // После успешного входа обновляем приложение
            this.multiUserManager.localUser = user;
            this.multiUserManager.saveUser(user);
            this.multiUserManager.renderUsers();
            this.multiUserManager.connectToServer();
            this.userModal.loadUserProfile();
            // Обновляем интерфейс (скрываем кнопку входа, показываем профиль)
            this.updateAuthUI();
            // Загружаем уведомления
            this.notificationManager.fetchNotifications(true);
        };
        */

        // ===== Инициализация компонентов =====
        // Компонент Drag-and-Drop для загрузки файлов
        this.dropZone = new DropZone(this);
                
        // Инициализация секций (сворачиваемые панели)
        this.initSections();

        // ===== Роутер (добавлен в 6.0) =====
        this.router = new Router();
        this.setupRoutes();
        this.router.navigate(window.location.pathname || '/', { replace: true });

        // ===== Загрузка и инициализация =====
        this.init();

        // ===== Настройка UI для многопользовательского режима =====
        this.setupMultiUserUI();
        this.updateUserCount();    
        // Добавлено в 5.1.
        this.setupNotificationUI(); 

        // ===== Подписка на события приватных чатов =====
        this.setupPrivateChatEvents();    

        // Добавлено в 5.2: убедимся, что highlight.js применён к уже существующим блокам кода
        // (это будет сделано в ChatView после загрузки сообщений)            

        // Удалено в 6.0: вызовы this.gameView = new GameView(this) и this.adminPanel = new AdminPanel(this)
        // теперь загружаются по требованию 

        // Навигация по умолчанию
        this.router.navigate(window.location.pathname || '/', { replace: true });        
    }

    // ===== Роутер ===== 

    // Добавлено в 6.0: определение маршрутов
    setupRoutes() {
        this.router.addRoute('/', () => this.showChat());
        this.router.addRoute('/private', () => this.showPrivateChats());
        this.router.addRoute('/admin', () => this.showAdmin());
        this.router.addRoute('/games', () => this.showGames());
        this.router.addRoute('/profile', () => this.showProfile());        
        /* Добавлено в 6.1: маршруты для настроек и статистики */
        this.router.addRoute('/settings', () => this.showSettings());
        this.router.addRoute('/stats', () => this.showStats());
        //Если не указано
        this.router.setNotFound(() => this.showChat());
    }

    // ===== Методы отображения модулей =====
    // ===== Методы переключения представлений =====

    async showSettings() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('app-settings').style.display = 'block';
        document.getElementById('app-stats').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        this.updateActiveNav('settings');

        if (!this.settingsModule) {
            const container = document.getElementById('app-settings');
            this.settingsModule = new SettingsModule(this, container);
        }
    }

    async showStats() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('app-settings').style.display = 'none';
        document.getElementById('app-stats').style.display = 'block';
        document.getElementById('sidebar').style.display = 'flex';
        this.updateActiveNav('stats');

        if (!this.statsModule) {
            const container = document.getElementById('app-stats');
            this.statsModule = new StatsModule(this, container);
        }
    }


    // Добавлено в 6.0: импорт модулей       
    showChat() {
        // Показываем чат, скрываем остальные
        // Если модуль чата ещё не создан, создаём его
        if (!this.chatModule) {
            this.chatModule = new ChatModule(this);
        } else {
            this.chatModule.show();
        }  
        // Показываем контейнер чата, скрываем остальные       
        document.getElementById('app-chat').style.display = 'flex';          
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        this.updateActiveNav('chat');
     
    }

    // Добавлено в 6.0: импорт модулей       
    // Метод showPrivateChats:
    async showPrivateChats() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'block';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('private');

        if (!this.privateChatModule) {
            const container = document.getElementById('app-private');
            this.privateChatModule = new PrivateChatModule(this, container);
        }
    }



    // Добавлено в 6.0: импорт модулей       
    async showAdmin() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';        
        document.getElementById('app-admin').style.display = 'block';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('admin');
        /*
        if (!this.adminModule) {
            try {
                const module = await import('./modules/admin/AdminModule.js');
                this.adminModule = new module.AdminModule(this);
                this.adminModule.enter();
            } catch (error) {
                console.error('Ошибка загрузки админ-модуля:', error);
                this.toast.error('Не удалось загрузить админ-панель');
            }
        } else {
            this.adminModule.enter();
        }
        */
        if (!this.adminLoaded) {
            try {
                const module = await import('./modules/admin/AdminModule.js');
                this.adminModule = new module.AdminModule(this);
                this.adminModule.init();
                this.adminLoaded = true;
            } catch (error) {
                console.error('Ошибка загрузки админ-модуля:', error);
                this.toast.error('Не удалось загрузить админ-панель');
            }
        } else {
            this.adminModule.init(); // повторное открытие
        }        
    }

    // Добавлено в 6.0: импорт модулей       
    async showGames() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'block';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('games');
        /*
        if (!this.gamesModule) {
            try {
                const module = await import('./modules/games/GamesModule.js');
                this.gamesModule = new module.GamesModule(this);
                this.gamesModule.enter();
            } catch (error) {
                console.error('Ошибка загрузки игрового модуля:', error);
                this.toast.error('Не удалось загрузить игры');
            }
        } else {
            this.gamesModule.enter();
        }
        */
        if (!this.gamesLoaded) {
            try {
                const module = await import('./modules/games/GamesModule.js');
                this.gamesModule = new module.GamesModule(this);
                this.gamesModule.init();
                this.gamesLoaded = true;
            } catch (error) {
                console.error('Ошибка загрузки игрового модуля:', error);
                this.toast.error('Не удалось загрузить игры');
            }
        } else {
            this.gamesModule.init();
        }       
    }

    // Добавлено в 6.0: импорт модулей       
    async showProfile() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'block';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('profile');
        /*
        if (!this.profileModule) {
            try {
                const module = await import('./modules/profile/ProfileModule.js');
                this.profileModule = new module.ProfileModule(this);
                this.profileModule.enter();
            } catch (error) {
                console.error('Ошибка загрузки профиля:', error);
                this.toast.error('Не удалось загрузить профиль');
                // Fallback: открываем ProfileModal
                this.profileModal.open();
            }
        } else {
            this.profileModule.enter();
        }
        */
        if (!this.profileLoaded) {
            try {
                const module = await import('./modules/profile/ProfileModule.js');
                const container = document.getElementById('app-profile');
                this.profileModule = new module.ProfileModule(this, container);
                this.profileLoaded = true;
            } catch (error) {
                console.error('Ошибка загрузки профиля:', error);
                this.toast.error('Не удалось загрузить профиль');
            }
        } else {
            // Если уже загружен, можно перерисовать или просто показать
            // Для простоты оставляем как есть, или вызываем метод обновления
            this.profileModule.updatePreview?.();
        }       
    }

    // Добавлено в 6.0: импорт модулей           
    updateActiveNav(section) {
        /*
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        */
        document.querySelectorAll('.nav-btn').forEach(btn => {
            const link = btn.dataset.link || '';
            const isActive = link === '/' ? section === 'chat' : link === `/${section}`;
            btn.classList.toggle('active', isActive);
        });       
    }

    // ===== Переопределённые методы для навигации (обёртки) =====
    openAdmin() {
        this.router.navigate('/admin');
    }
     
    openProfileInfo() {
        this.router.navigate('/profile');
    }

    openGames() {
        this.router.navigate('/games');
    }

    // ... остальные методы (init, openPrivateChat, stopGeneration, setupEventListeners, etc.) ...
    // Поскольку они не меняются, пропускаю для краткости, но в полной сборке они остаются без изменений.
    // Однако в методе init нужно убрать вызовы, связанные со старым syntaxHighlighter.
    // Например, в init() удаляем вызовы типа: setTimeout(() => { document.querySelectorAll(...) ... }) 
    // и заменяем на использование hljs (если нужно).
    // Также в renderModelDropdown и других местах убираем ссылки на syntaxHighlighter.

    // Изменения в init: удаляем старую подсветку и полагаемся на markdownService и highlight.js
    // (в chat-view и message-renderer уже используется markdownService)

    /**

     * Открытие приватного чата
     * Добавлено в 5.1: поддержка выбора пользователя
     */
    /* Удалено 6.1
        openPrivateChat() {
        this.privateChat.open();
        //document.getElementById('roomInfoModal').classList.add('active');
    } 
    */
   
    // Переопределяем openPrivateChat
    /**
     * Логика открытия приватного чата (Объединенная версия)
     * @param {Object|null} user - Объект пользователя для начала чата
     */
    async openPrivateChat(user = null) {
        // 1. Если пользователь не выбран — показываем список всех доступных пользователей
        if (!user) {
            const users = this.multiUserManager.getAvailableUsers();
            if (users.length === 0) {
                this.toast.warning('Нет доступных пользователей');
                return;
            }
            this.showUserSelector(users); // Метод выбора пользователя из списка
            return;
        }
        
        // 2. Если пользователь передан — открываем конкретный чат
        const chatId = await this.multiUserManager.openPrivateChat(user);
        if (chatId) {
            this.privateChat.open(user);
        }
    }

    /**
     * Инициализация приложения
     * Загружает конфигурацию, восстанавливает сессию, подключает сервисы
     * Добавлено в 5.1: восстановление сессии через AuthService
     */    
    async init() {
        // Загрузка конфигурации сервера из localStorage
        loadServerConfig();

        // Применение темы оформления
        applyTheme(this.currentTheme);

        // Загрузка данных RAG из сессии
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

        // Проверка доступности сервера
        await this.api.checkServer();

        /* Изменено в 6.2: синхронизируем текущую модель с ApiService ПОСЛЕ fetchModels (KI-029).
           Если ApiService загрузил список моделей, он уже выбрал правильную currentModel. */
        if (this.api.currentModel) {
            this.currentModel = this.api.currentModel;
        }

        // Загрузка модели для текущего чата (с валидацией — KI-029)
        const model = this.sessionManager.getModelForChat();
        if (model && this.api.availableModels.includes(model)) {
            this.currentModel = model;
        } else if (model && !this.api.availableModels.includes(model)) {
            /* Модель из сессии больше недоступна — используем текущую из ApiService */
            console.warn(`⚠️ Модель "${model}" недоступна, используем "${this.currentModel}"`);
            this.sessionManager.setModelForChat(this.currentModel);
        }

        /* Перерисовываем выпадающий список моделей (с правильным currentModel) */
        this.renderModelDropdown(this);
        this.updateModelUI();

        // Рендеринг UI (часть, которая не зависит от модулей)
        this.sidebar.render();
        this.chatView.render();
        this.renderAssistantBar();
        this.roadmapTracker.render();
        this.updateStats();
        this.multiUserManager.renderUsers();

        // Удалено в 5.4: запуск симуляции пользователей (отключена)
        //this.multiUserManager.startSimulation();

        // Добавлено в 5.1: Проверка сессии при загрузке
        // Восстановление сессии     
        const user = await this.authService.restoreSession();
        if (user) {
            // Пользователь уже авторизован
            this.multiUserManager.localUser = user;
            this.multiUserManager.saveUser(user);
            this.multiUserManager.renderUsers();
            this.multiUserManager.connectToServer();
            // this.userModal.loadUserProfile();  // Удалено 5.3
            
            //Добавлено 5.3
            this.profileModal.loadUserProfile();

            this.updateAuthUI();
            // Загружаем уведомления
            this.notificationManager.fetchNotifications(true);
        } else {
            // Показываем форму входа
            //this.authModal.open(); // Удалено 5.3
            this.profileModal.open();  // Показываем вход 5.4
        }

        // Фокус на поле ввода
        this.chatView.focusInput();

        // Обновление счетчика символов
        this.chatView.updateCharCounter();

        // Инициализация выбора режима Drag-and-Drop
        this.selectDragMode('rag');

        // Автозапуск тестов
        setTimeout(() => {
            runAllTests();
        }, 500);

        // Удалено в 5.2: ручная подсветка синтаксиса через старый syntaxHighlighter
        // Теперь подсветка выполняется через markdownService и highlight.js при рендеринге  

        /*
        // Применение подсветки синтаксиса после загрузки Удалено в 5.2
        setTimeout(() => {
            document.querySelectorAll('.message .bubble pre code').forEach(el => {
                if (!el.classList.contains('hljs')) {
                    const code = el.textContent;
                    const lang = el.className.replace('language-', '') || 'text';
                    // Подсветка будет применена при рендеринге
                }
            });
        }, 500);
        */
        // Настройка периодических задач
        setInterval(() => this.api.checkServer(), CONFIG.SERVER.CHECK_INTERVAL);
        setInterval(() => this.updateStats(), CONFIG.DEBOUNCE.STATS);

        // Подписка на события
        this.setupEventListeners(this);

        // Приветственные сообщения
        this.toast.info(`🚀 Infocom LM Chat Pro v${CONFIG.VERSION}`, 2000);
        this.toast.info('💡 Используйте Ctrl+↑ и Ctrl+↓ для истории сообщений', 3000);
        this.toast.info('🚀 v6.0 — Модульная архитектура, SPA-роутинг, разделение на подсистемы', 3000);                

        console.log(`✅ Infocom LM Chat Pro v${CONFIG.VERSION}`);
        console.log('🛡️ XSS-защита: активна (DOMPurify)');
        console.log('♿ Доступность: ARIA + клавиатура');
        console.log('📝 Markdown: включён');        
        console.log('⚡ EventBus: активен');
        console.log('🧩 Модульная архитектура: активна');        
    }

    // ===== Остальные методы (без изменений, кроме тех, что используют chatView/sidebar) =====
    // Все методы, которые ранее обращались к this.chatView или this.sidebar,
    // теперь должны обращаться через this.chatModule.chatView и this.chatModule.sidebar.
    // Чтобы избежать поломок, оставляем геттеры: (Лишние)
    /*     
    get chatView() {
        return this.chatModule ? this.chatModule.chatView : null;
    } 
    */

    /*     
    get sidebar() {
        return this.chatModule ? this.chatModule.sidebar : null;
    } 
    */

    /**
     * Остановка генерации ответа
     * Вызывается при нажатии кнопки СТОП
     */
    stopGeneration() {
        if (this.streamAbortController) {
            // Отменяем запрос
            this.streamAbortController.abort();
            this.streamAbortController = null;
            this.isProcessing = false;
            
            // Обновляем UI
            const sendBtn = document.getElementById('sendBtn');
            if (sendBtn) {
                sendBtn.classList.remove('stop-btn');
                sendBtn.textContent = 'Отправить';
                sendBtn.disabled = false;
            }
            
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
            
            this.toast.info('⏹ Генерация остановлена', 2000);
            console.log('🛑 Генерация остановлена пользователем');
        } else {
            // Если нет активного контроллера, но есть активные запросы в api
            if (this.api) {
                const aborted = this.api.abortAllRequests();
                if (aborted > 0) {
                    this.isProcessing = false;
                    this.toast.info(`⏹ Остановлено ${aborted} запросов`, 2000);
                }
            }
        }
        
        // Обновляем состояние
        this.updateStats();
    }

    /**
     * Настройка глобальных обработчиков событий
     * Добавлено в 5.1: обработчики для уведомлений и аналитики
     */    
    setupEventListeners(app) {
        // Глобальные обработчики клавиш
        document.addEventListener('keydown', this.handleGlobalKeys.bind(this));

        //this.userModal.setupEventListeners();

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
            // Загружаем уведомления при подключении
            this.notificationManager.fetchNotifications(true);
        });

        this.eventBus.on('server:disconnected', () => {
            console.warn('❌ Сервер недоступен');
        });

        this.eventBus.on('theme:changed', (theme) => {
            this.currentTheme = theme;
        });

        // Глобальный обработчик для кнопки СТОП
        // Обработчик для кнопки СТОП (обработка через делегирование)        
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                // Если кнопка в состоянии "СТОП"
                if (sendBtn.classList.contains('stop-btn')) {
                    this.stopGeneration();
                }
            });
        }

        // Глобальная обработка клавиш для отмены (Escape)
        document.addEventListener('keydown', (e) => {
            // Escape отменяет генерацию (если есть активный запрос)
            if (e.key === 'Escape' && this.isProcessing) {
                this.stopGeneration();
                e.preventDefault();
            }
        });  

        // Глобальная обработка смены модели
        document.getElementById('modelBadge').onclick = function(e) {
            e.stopPropagation();
            document.getElementById('modelDropdown').classList.toggle('active');
        };

        // Глобальный обработчик для кнопки смены темы
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                cycleTheme();
            });
        }
        
        // === Добавлено в 5.1: Кнопка аналитики ===
        const analyticsBtn = document.getElementById('analyticsBtn');
        if (analyticsBtn) {
            analyticsBtn.addEventListener('click', () => {
                this.analyticsView.open();
            });
        }

        // === Кнопка уведомлений ===
        const notifBtn = document.getElementById('notificationBtn');
        if (notifBtn) {
            notifBtn.addEventListener('click', () => {
                this.showNotificationsModal();
            });
        }

        // === ОБЩИЕ ПОДПИСКИ НА СОБЫТИЯ ДЛЯ МОДАЛЬНЫХ ОКОН ===

        // Открытие модального окна "Поделиться"
        document.getElementById('shareBtn').onclick = app.openShareModal;

        // Закрытие модального окна "Поделиться"
        document.getElementById('shareModalClose').onclick = () => {
            document.getElementById('shareModal').classList.remove('active');
        };

        // Закрытие модального окна "Поделиться" при клике вне области модалки
        document.getElementById('shareModal').onclick = (e) => {
            if (e.target === document.getElementById('shareModal')) {
                document.getElementById('shareModal').classList.remove('active');
            }
        };

        /* 5.4 УДАЛЕНО
        // Закрытие модалки информации о пользователе
        document.getElementById('userModalClose')?.addEventListener('click', () => {
            document.getElementById('userModal').classList.remove('active');
        });

        // Закрытие модального окна информации о пользователе при клике вне области модалки
        document.getElementById('userModal').onclick = (e) => {
            if (e.target === document.getElementById('userModal')) {
                document.getElementById('userModal').classList.remove('active');
            }
        };        
        */
        // Закрытие модального окна "Промт" по кнопке закрытия
        document.getElementById('promptModalClose').onclick = () => {
            document.getElementById('promptModal').classList.remove('active');
        };

        // Закрытие модального окна "Промт" при клике вне области модалки
        document.getElementById('promptModal').onclick = (e) => {
            if (e.target === document.getElementById('promptModal')) {
                document.getElementById('promptModal').classList.remove('active');
            }
        };

        // Закрытие модального окна "Пользовательский ассистент" по кнопке закрытия
        document.getElementById('customAssistantModalClose').onclick = () => {
            document.getElementById('customAssistantModal').classList.remove('active');
        };

        // Закрытие модального окна "Пользовательский ассистент" при клике вне области модалки
        document.getElementById('customAssistantModal').onclick = (e) => {
            if (e.target === document.getElementById('customAssistantModal')) {
                document.getElementById('customAssistantModal').classList.remove('active');
            }
        };

        // Отмена создания ассистента в модальном окне
        document.getElementById('caCancelBtn').onclick = () => {
            document.getElementById('customAssistantModal').classList.remove('active');
        };

        // === ВЫБОР ЦВЕТА ДЛЯ АССИСТЕНТА ===

        // Обработка выбора цвета из палитры
        document.querySelectorAll('.color-preset').forEach(el => {
            el.onclick = function () {
                // Убираем выделение у всех элементов палитры
                document.querySelectorAll('.color-preset').forEach(e => e.classList.remove('selected'));
                // Добавляем выделение к выбранному элементу
                this.classList.add('selected');
            };
        });

        // === СОЗДАНИЕ ПОЛЬЗОВАТЕЛЬСКОГО АССИСТЕНТА ===

        // Сохранение нового пользовательского ассистента
        document.getElementById('caSaveBtn').onclick = () => {
            // Получаем значения из полей формы
            const name = document.getElementById('caName').value.trim();
            const icon = document.getElementById('caIcon').value.trim() || '🤖';
            const desc = document.getElementById('caDesc').value.trim();
            const prompt = document.getElementById('caPrompt').value.trim();

            // Получаем выбранный цвет (или используем цвет по умолчанию)
            const color = document.querySelector('.color-preset.selected')?.dataset.color || '#7ec8e3';

            //const am = new AssistantManager();
            //const toast = new ToastManager();
            // Проверка обязательных полей
            if (!name || !prompt) {
                app.toast.warning('Название и промт обязательны');
                return;
            }

            // Добавляем нового ассистента через менеджер
            app.assistantManager.addCustom(name, icon, desc, color, prompt);

            // Закрываем модальное окно
            document.getElementById('customAssistantModal').classList.remove('active');

            // Обновляем отображение панели ассистентов
            app.renderAssistantBar();

            // Показываем уведомление об успешном создании
            app.toast.success(`✅ Ассистент "${name}" создан!`);
        };

        document.addEventListener('click', () => document.getElementById('modelDropdown').classList.remove('active'));        

        document.getElementById('analyticsBtn')?.addEventListener('click', () => {
            this.analyticsView.open();
        });

        document.getElementById('newPrivateChatBtn')?.addEventListener('click', () => {
            this.privateChat.showUserSelector();
        });        

        // Кнопка для перехода в приватные чаты (в шапке):
        document.getElementById('privateChatBtn')?.addEventListener('click', () => {
            this.router.navigate('/private');
        });        

        // ===== CLEAR RAG =====
        document.getElementById('clearRagBtn')?.addEventListener('click', () => {
            if (confirm('Очистить все RAG документы?')) {
                app.ragManager.clear();
                app.sessionManager.setRAG(null);
                this.updateRagFilesUI();
                document.getElementById('ragBtn').style.color = 'var(--text-accent)';
                app.toast.info('RAG контекст очищен');
                this.updateStats();
            }
        });        
    }

    /**
     * Открытие модального окна для совместного доступа
     */
    openShareModal() {
        // Генерируем случайный ID комнаты (6 символов в base36)
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Формируем URL для совместного доступа
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

        // Устанавливаем URL в поле ввода
        document.getElementById('shareUrl').value = shareUrl;

        // Создаем QR-код и отображаем его
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        qrCodeContainer.innerHTML = `QR`;
        let shareHtml = '';
        if(window.app) {
            // Собираем HTML для отображения активных пользователей
            if(window.app.multiUserManager.localUser.Name)
            {
                shareHtml = `${window.app.multiUserManager.localUser.Avatar} ${window.app.sanitizeHTML(window.app.multiUserManager.localUser.Name)} (Вы)`;
            }
            else
            {
                shareHtml = `${window.app.multiUserManager.localUser.avatar} ${window.app.sanitizeHTML(window.app.multiUserManager.localUser.name)} (Вы)`;
            }

            // Добавляем каждого подключенного пользователя в список
            window.app.multiUserManager.peers.forEach(peer => {
                if(peer.Name)
                {
                    shareHtml += `${peer.Avatar} ${window.app.sanitizeHTML(peer.Name)}`;
                }
                else
                {
                    shareHtml += `${peer.avatar} ${window.app.sanitizeHTML(peer.name)}`;
                }
            });
        }

        // Отображаем список пользователей в модальном окне
        document.getElementById('activeUsers').innerHTML = shareHtml;

        // Показываем модальное окно
        document.getElementById('shareModal').classList.add('active');

        // Проверяем и разблокируем достижение за первое деление доступом
        if(window.app) {
            window.app.achievementManager.checkAndUnlock('share_first');
        }
    }

    /**
     * Обработка глобальных клавиш
     */
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

    /**
     * Обновление отображения текущей модели
     */
    updateModelUI() {
        const currentModelLabel = document.getElementById('currentModelLabel');
        if (currentModelLabel) {
            const display = this.currentModel.length > 40 ? 
                this.currentModel.substring(0, 37) + '...' : 
                this.currentModel;
            currentModelLabel.textContent = `Модель: ${display}`;
        }
    }

    /**
     * Рендеринг выпадающего списка моделей
     */
     renderModelDropdown(object) {
        const modelDropdown = document.getElementById('modelDropdown');
        const currentModelLabel = document.getElementById('currentModelLabel');                
        if (!object.api.availableModels.length) {
            modelDropdown.innerHTML = `<div class="model-item" style="color:var(--text-secondary);">Модели не найдены</div>`;
            return;
        }
        let html = '';
        object.api.availableModels.forEach(m => {
            const active = m === object.currentModel;
            html += `<div class="model-item ${active ? 'active-model' : ''}" data-model="${object.sanitizeHTML(m)}" role="option" aria-selected="${active}">
            <span>${object.sanitizeHTML(m)}</span>${active ? '<span class="check">✔</span>' : ''}
        </div>`;
        });
        modelDropdown.innerHTML = html;
        document.querySelectorAll('.model-item').forEach(el => {
            el.onclick = function(e) {
                e.stopPropagation();
                const name = this.dataset.model;
                if (name && name !== object.currentModel) {                    
                    object.currentModel = name;
                    // Сохраняем модель для текущего чата
                    object.sessionManager.setModelForChat(object.currentModel);
                    object.updateModelUI();
                    object.renderModelDropdown(object);
                    object.toast.success(`Модель: ${object.currentModel}`);
                }
                modelDropdown.classList.remove('active');
            };
        });
    }

    /**
     * Обновление статистики
     */
    updateStats() {
        // Вызов из других мест (например, из событий) остаётся без изменений,
        // но внутри используем this.chatView и this.sidebar через геттеры.
        // В этом методе мы обновляем статистику, которая не зависит от модуля.        
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

    /**
     * Обновление UI файлов RAG
     */
    updateRagFilesUI() {
        // Аналогично, обновляем UI RAG, не зависящий от модуля        
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

    /**
     * Обновление UI прикреплённых файлов
     */
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

    /**
     * Рендеринг панели ассистентов
     */
    renderAssistantBar() {
        renderAssistantBar(this);
    }

    /**
     * Обновление индикатора активного ассистента
     */
    updateActiveIndicator() {
        updateActiveIndicator(this);
    }

    // ===== Reply Target =====

    /**
     * Установка цели для ответа на сообщение
     */
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

    /**
     * Очистка цели ответа
     */
    clearReplyTarget() {
        this.replyTarget = null;
        const userInput = document.getElementById('userInput');
        if (userInput) {
            //userInput.placeholder = 'Введите вопрос или код... (Ctrl+Enter для отправки)';
            userInput.placeholder = this.i18n.t('chat.input_placeholder');
        }
        document.querySelectorAll('.message.reply-target').forEach(el => {
            el.classList.remove('reply-target');
        });
    }

    // ===== Drag Mode =====

    /**
     * Выбор режима Drag-and-Drop
     */
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

    /**
     * Отображение разблокированного достижения
     */
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

    /**
     * Санитизация HTML для защиты от XSS
     */
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Чтение текстового содержимого файла
     */
    getFileText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Проверка разрешённого типа файла
     */
    isFileAllowed(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (CONFIG.SECURITY.ALLOWED_EXTENSIONS.includes(ext)) return true;
        if (file.type.startsWith('text/')) return true;
        return false;
    }

    /**
     * Валидация ввода пользователя
     */
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

    /**
     * Проверка длины ввода
     */
    validateLength(text) {
        return text.length <= CONFIG.LIMITS.MAX_INPUT_LENGTH;
    }

    // ===== UI для уведомлений =====

    /**
     * Настройка UI уведомлений
     * Добавлено в 5.1.
     */
    setupNotificationUI() {
        const notifBtn = document.getElementById('notificationBtn');
        if (notifBtn) {
            notifBtn.style.position = 'relative';
            // Бейдж уже есть в HTML
        }
        // Подписка на обновления уведомлений
        this.eventBus.on('notifications:updated', () => {
            this.notificationManager.updateBadge();
        });        
        /*
        // Иконка уведомлений в шапке
        const notifBtn = document.createElement('button');
        notifBtn.id = 'notificationBtn';
        notifBtn.title = 'Уведомления';
        notifBtn.innerHTML = '🔔<span id="notificationBadge" style="display:none;position:absolute;top:-4px;right:-4px;background:red;color:#fff;border-radius:50%;padding:1px 6px;font-size:10px;">0</span>';
        notifBtn.style.position = 'relative';
        // Добавляем в header-actions
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.prepend(notifBtn);
        }
        notifBtn.addEventListener('click', () => {
            this.showNotificationsModal();
        });
        */
    }
    
    /**
     * Показать модальное окно уведомлений
     * Добавлено в 5.1.
     */
    showNotificationsModal() {
        // Создаём модальное окно со списком уведомлений
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:500px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h2>🔔 Уведомления</h2>
                <div id="notificationsList" style="max-height:400px;overflow-y:auto;">
                    ${this.notificationManager.notifications.length ? 
                        this.notificationManager.notifications.map(n => `
                            <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-id="${n.notificationId}">
                                <div class="notif-icon">${n.type === 'mention' ? '@' : n.type === 'reaction' ? '❤️' : '💬'}</div>
                                <div class="notif-content">
                                    <div class="notif-title">${this.sanitizeHTML(n.title)}</div>
                                    <div class="notif-body">${this.sanitizeHTML(n.body)}</div>
                                    <div class="notif-time">${new Date(n.createdAt).toLocaleString()}</div>
                                </div>
                                ${!n.isRead ? `<button class="mark-read-btn" data-id="${n.notificationId}">✅</button>` : ''}
                            </div>
                        `).join('') 
                        : '<div style="padding:20px;text-align:center;color:var(--text-secondary);">Нет уведомлений</div>'
                    }
                </div>
                <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
                    <button id="markAllReadBtn" class="btn-secondary">✅ Отметить все прочитанными</button>
                    <button id="closeNotifModal" class="btn-secondary">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        // Обработчики
        modal.querySelector('#closeNotifModal').addEventListener('click', () => modal.remove());
        modal.querySelector('#markAllReadBtn').addEventListener('click', async () => {
            await this.notificationManager.markRead([]);
            modal.querySelector('#notificationsList').querySelectorAll('.notification-item').forEach(el => {
                el.classList.remove('unread');
                el.classList.add('read');
                const btn = el.querySelector('.mark-read-btn');
                if (btn) btn.remove();
            });
            this.notificationManager.updateBadge();
        });
        modal.querySelectorAll('.mark-read-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                await this.notificationManager.markRead([id]);
                const item = btn.closest('.notification-item');
                item.classList.remove('unread');
                item.classList.add('read');
                btn.remove();
                this.notificationManager.updateBadge();
            });
        });
        // Закрытие по клику вне
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    /**
     * Обновление UI в зависимости от статуса аутентификации
     * Добавлено в 5.1.
     * 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа      
     */
    updateAuthUI() {  
        const isAuth = this.authService.isAuthenticated;
        // Показываем/скрываем элементы
        //const loginBtn = document.getElementById('loginBtn'); // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        //const logoutBtn = document.getElementById('logoutBtn'); // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        //const profileBtn = document.getElementById('userProfileBtn'); // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        const adminBtn = document.getElementById('adminBtn');
        
        //if (loginBtn) loginBtn.style.display = isAuth ? 'none' : 'inline-block'; // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        //if (logoutBtn) logoutBtn.style.display = isAuth ? 'inline-block' : 'none'; // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        //if (profileBtn) profileBtn.style.display = isAuth ? 'inline-block' : 'none'; // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
        if (adminBtn) {
            adminBtn.style.display = (isAuth && this.multiUserManager.isAdminUser()) ? 'inline-block' : 'none';
        }
    }

    // Удалено в 5.4: дублирующий метод showUserSelector
    /*
    showUserSelector(users) {
        // Создаем модальное окно для выбора пользователя
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h2>👥 Выберите пользователя</h2>
                <div style="max-height:300px;overflow-y:auto;">
                    ${users.map(u => `
                        <div class="user-select-item" data-user-id="${u.Id}" style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-radius:8px;transition:background 0.2s;border-bottom:1px solid var(--border-color);">
                            <span style="font-size:28px;">${u.Avatar}</span>
                            <div>
                                <div style="font-weight:600;">${this.sanitizeHTML(u.Name)}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${u.IsTyping ? 'печатает...' : 'онлайн'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.user-select-item').forEach(el => {
            el.addEventListener('click', () => {
                const userId = el.dataset.userId;
                const user = this.multiUserManager.peers.get(userId);
                if (user) {
                    modal.remove();
                    this.privateChat.open(user);
                }
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
    */
    
    // ===== Многопользовательский режим =====

    /**
     * Настройка UI для многопользовательского режима
     * Добавлено в 5.1: кнопки для администрирования и приватных чатов
     * 5.3  В методе setupMultiUserUI заменяем вызовы    
     */
    setupMultiUserUI() {
        // Кнопка подключения
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                if (this.multiUserManager.isConnected) {
                    // Отключение
                    await this.multiUserManager.leaveRoom();
                    this.toast.info('Отключено от сервера');
                    this.updateUserCount();
                    this.updateRoomInfoUI();
                } else {
                    // Подключение
                    this.toast.info('Подключение к серверу...');
                    const success = await this.multiUserManager.connectToServer();
                    if (success) {
                        this.toast.success('✅ Подключено к серверу');
                        this.updateUserCount();
                        this.updateRoomInfoUI();
                        // Загружаем историю
                        this.chatView.loadMessages();
                    } else {
                        this.toast.error('❌ Не удалось подключиться');
                    }
                }
            });
        }
 
        // Кнопка открытия Администрирования
        document.getElementById('adminBtn')?.addEventListener('click', () => {
            //this.openAdmin();
            this.router.navigate('/admin');
        });
        
        // Кнопка открытия приватного чата
        document.getElementById('privateChatBtn')?.addEventListener('click', () => {
            this.openPrivateChat();
        });

        // Кнопка информации о пользователе
        document.getElementById('userProfileBtn')?.addEventListener('click', () => {
            //this.openProfileInfo();
            this.router.navigate('/profile');
        });

        // Кнопка игр
        document.getElementById('gameBtn')?.addEventListener('click', () => {
            this.router.navigate('/games');
        });

        // Кнопка информации о комнате
        document.getElementById('roomInfoBtn')?.addEventListener('click', () => {
            this.openRoomInfo();
        });

        // Закрытие модалки комнаты
        document.getElementById('roomInfoModalClose')?.addEventListener('click', () => {
            document.getElementById('roomInfoModal').classList.remove('active');
        });

        // Обновление информации о комнате
        document.getElementById('roomInfoRefreshBtn')?.addEventListener('click', () => {
            this.updateRoomInfoUI();
        });

        // Выход из комнаты
        document.getElementById('roomInfoLeaveBtn')?.addEventListener('click', async () => {
            if (confirm('Выйти из комнаты?')) {
                await this.multiUserManager.leaveRoom();
                document.getElementById('roomInfoModal').classList.remove('active');
                this.toast.info('Вы вышли из комнаты');
                this.updateUserCount();
                this.updateRoomInfoUI();
            }
        });
    }

    /**
     * Обновление счётчика пользователей
     */
    updateUserCount() {
        const count = this.multiUserManager.peers.size + 1;
        const display = document.getElementById('userCountDisplay');
        if (display) {
            display.textContent = `👥 ${count} онлайн`;
        }
        // Обновляем sidebar
        this.multiUserManager.renderUsers();
    }

    /**
     * Обновление UI информации о комнате
     */
    updateRoomInfoUI() {
        const status = this.multiUserManager.getStatus();
        document.getElementById('roomInfoId').textContent = status.roomId || '—';
        document.getElementById('roomInfoName').textContent = status.roomName || '—';
        document.getElementById('roomInfoUsers').textContent = status.userCount || 0;
        document.getElementById('roomInfoMessages').textContent = status.messageCount || 0;
        document.getElementById('roomInfoStatus').textContent = status.isConnected ? '🟢 Подключен' : '⚪ Отключен';
        document.getElementById('roomInfoStatus').style.color = status.isConnected ? 'var(--success-color)' : 'var(--text-secondary)';
    }

    /**
     * Открытие профиля пользователя
     */
    // 5.3 Обновляем метод openProfileInfo    
    openProfileInfo() {
        //this.userModal.open(); /* Удалено в 5.3 */
        //document.getElementById('roomInfoModal').classList.add('active');
        this.profileModal.open();   /* Изменено в 5.3 */        
    }    

    // 5.3 Удаляем старую updateAuthUI, если есть, или оставляем только для кнопки админа
    // 5.3  В методе setupMultiUserUI заменяем вызовы    

    /**
     * Открытие панели администратора
     */
    // Удалено в 6.0: теперь используется роутер
    /*
    openAdmin() {
        this.adminPanel.open();
        //document.getElementById('roomInfoModal').classList.add('active');
    } 
    */         

    /**
     * Открытие информации о комнате
     */
    openRoomInfo() {
        this.updateRoomInfoUI();
        document.getElementById('roomInfoModal').classList.add('active');
    }    

    // Подписка на события MultiUserManager
    setupMultiUserEvents() {
        this.eventBus.on('room:joined', (data) => {
            this.toast.success(`👥 Вошли в комнату: ${data.users?.length || 0} пользователей`);
            this.updateUserCount();
            this.updateRoomInfoUI();
        });

        this.eventBus.on('room:left', () => {
            this.toast.info('Вы вышли из комнаты');
            this.updateUserCount();
            this.updateRoomInfoUI();
        });

        this.eventBus.on('message:new', (message) => {
            this.toast.info(`💬 ${message.userName}: ${message.content?.substring(0, 50)}...`);
        });

        this.eventBus.on('users:updated', () => {
            this.updateUserCount();
        });

        this.eventBus.on('server:connected', () => {
            document.getElementById('connectBtn').textContent = '🌐 Отключиться';
            document.getElementById('connectBtn').style.color = 'var(--success-color)';
        });

        this.eventBus.on('server:disconnected', () => {
            document.getElementById('connectBtn').textContent = '🌐 Подключиться';
            document.getElementById('connectBtn').style.color = '';
        });
    }
    
    /**
     * Настройка событий приватных чатов
     */    
    setupPrivateChatEvents() {
        // Событие открытия приватного чата
        this.eventBus.on('private:chat_opened', (data) => {
            const peer = this.multiUserManager.peers.get(data.user.Id);
            if (peer) {
                this.privateChat.open(peer);
            }
        });

        // Обновление непрочитанных
        this.eventBus.on('private:unread_updated', (count) => {
            this.updateUnreadBadge(count);
        });

        // Обновление списка чатов
        this.eventBus.on('private:chats_updated', () => {
            this.sidebar.renderPrivateChats();
        });

        // Получение нового приватного сообщения
        this.eventBus.on('private:message_received', (message) => {
            this.toast.info(`💬 Приватное сообщение от ${message.senderName}`);
            this.sidebar.renderPrivateChats();
            this.updateUnreadBadge();
        });
    }

    /**
     * Обновление бейджа непрочитанных сообщений
     */
    updateUnreadBadge(count) {
        const badge = document.getElementById('unreadBadge');
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
        
    /**
     * Инициализация сворачиваемых секций
     */
    initSections() {
        // Определяем все секции
        const sectionConfigs = [
            { id: 'statsPanel', headerSelector: '[data-section="statsPanel"]' },
            { id: 'usersOnlinePanel', headerSelector: '[data-section="usersOnlinePanel"]' },
            { id: 'roadmapPanel', headerSelector: '[data-section="roadmapPanel"]' },
            { id: 'privateChatsPanel', headerSelector: '[data-section="privateChatsPanel"]' },
            { id: 'roomsPanel', headerSelector: '[data-section="roomsPanel"]' } // Добавлено в 5.1.
        ];

        sectionConfigs.forEach(({ id, headerSelector }) => {
            const header = document.querySelector(headerSelector);
            const content = document.getElementById(id);
            
            if (header && content) {
                // Устанавливаем data-атрибут, если его нет
                if (!header.dataset.section) {
                    header.dataset.section = id;
                }
                
                // Инициализируем секцию
                sectionToggle.initSection(id, header, content);
                
                // Добавляем обработчик клика, если его нет
                if (!header._toggleHandler) {
                    header._toggleHandler = true;
                    header.addEventListener('click', (e) => {
                        e.preventDefault();
                        sectionToggle.toggle(id);
                    });
                }
            }
        });

        // Делаем функции доступными глобально для обратной совместимости
        window.toggleSection = SectionHelpers.toggleSection;
        window.sectionToggle = sectionToggle;

        SectionHelpers.collapseAllSections();
    }    

    // ===== Остальные методы (init, updateStats, renderAssistantBar и т.д.) =====
    // Они остаются без изменений, так как используют this.chatView и this.sidebar,
    // которые теперь ссылаются на экземпляры из ChatModule.

    // (Здесь должны быть все методы, которые были в app.js до изменений,
    //  включая init, updateStats, renderAssistantBar, updateActiveIndicator,
    //  setReplyTarget, clearReplyTarget, selectDragMode, showAchievement,
    //  sanitizeHTML, getFileText, isFileAllowed, validateInput, validateLength,
    //  setupNotificationUI, showNotificationsModal, updateAuthUI,
    //  openPrivateChat, openShareModal, handleGlobalKeys, updateModelUI,
    //  renderModelDropdown, updateRagFilesUI, updateAttachedFilesUI,
    //  stopGeneration, setupEventListeners и другие.)
    // Для краткости я не дублирую их здесь, они уже есть в проекте.
    // Однако важно, чтобы все они были сохранены в итоговом файле.
    // В этом ответе я привожу только изменённые части.
}

// Запуск приложения
const app = new App();
// Для доступа из консоли (отладка)
window.app = app;

export default app;