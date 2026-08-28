// src/app.js
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
import { AuthService } from './services/auth-service.js';
import { NotificationManager } from './models/notification-manager.js';
import { markdownService } from './services/markdown-service.js';
import { applyTheme, cycleTheme } from './ui/theme.js';
// Изменено в 6.0: импорт ChatModule вместо прямых ChatView и Sidebar
import { ChatModule } from './modules/chat/ChatModule.js';
import { SettingsView } from './ui/views/settings-view.js';
import { InfoView } from './ui/views/info-view.js';
import { ShareView } from './ui/views/share-view.js';
// Удалено в 6.0: импорт GameView (теперь динамический)
// import { GameView } from './ui/views/game-view.js';
import { ExportView } from './ui/views/export-view.js';
import { AnalyticsView } from './ui/views/analytics-view.js';
import { renderAssistantBar, updateActiveIndicator, viewPrompt, deleteAssistant, openCustomAssistantModal } from './ui/views/assistant-bar.js';
import { runAllTests } from './utils/test-runner.js';
import { DropZone } from './ui/components/drop-zone.js';
import sectionToggle from './ui/components/section-toggle.js';
import { SectionHelpers } from './utils/section-helpers.js';
// 5.3 Удалены импорты AuthModal и UserModal
// import { UserModal } from './ui/views/user-modal.js';
// Удалено в 6.0: импорт AdminPanel (теперь динамический)
// import { AdminPanel } from './ui/views/admin-panel.js';
import { PrivateChat } from './ui/views/private-chat.js';
// 5.3 Удалены импорты AuthModal и UserModal
// import { AuthModal } from './ui/views/auth-modal.js';
import { ProfileModal } from './ui/views/profile-modal.js';   /* Добавлено в 5.3 */
import { Router } from './core/router.js'; /* Добавлено в 6.0 */

// Добавлено в 6.0: импорт модулей
import { PrivateChatModule } from './modules/private/PrivateChatModule.js';
// Добавлено в 6.0: для динамической загрузки AdminModule, GamesModule, ProfileModule
// они будут импортироваться через import() в методах showAdmin, showGames, showProfile

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
        this.multiUserManager = new MultiUserManager(this.eventBus);
        
        // Отслеживание прогресса развития проекта (дорожная карта)
        this.roadmapTracker = new RoadmapTracker(this.eventBus);

        // Добавлено в 5.1: Управление уведомлениями
        this.notificationManager = new NotificationManager(this);        

        // ===== Инициализация сервисов =====
        // Сервис для работы с API
        this.apiService = new ChatApiClient(this.eventBus);
        // Сервис для работы с API проверки статуса сервера
        this.api = new ApiService(this.eventBus);

        // Добавлено в 5.1: Сервис аутентификации и управления сессиями
        this.authService = new AuthService(this.eventBus);
        // Добавлено в 5.2: сервис Markdown
        this.markdownService = markdownService;

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
        this.privateChatModule = null;

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
    }

    // Добавлено в 6.0: определение маршрутов
    setupRoutes() {
        this.router.addRoute('/', () => this.showChat());
        this.router.addRoute('/private', () => this.showPrivateChats());
        this.router.addRoute('/admin', () => this.showAdmin());
        this.router.addRoute('/games', () => this.showGames());
        this.router.addRoute('/profile', () => this.showProfile());        
        this.router.setNotFound(() => this.showChat());
    }

    // ===== Методы переключения представлений =====

    showChat() {
        // Показываем чат, скрываем остальные
        this.chatModule.show();
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        this.updateActiveNav('chat');
    }

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

    async showAdmin() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'block';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('admin');

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
    }

    async showGames() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'block';
        document.getElementById('app-profile').style.display = 'none';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('games');

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
    }

    async showProfile() {
        document.getElementById('app-chat').style.display = 'none';
        document.getElementById('app-private').style.display = 'none';
        document.getElementById('app-admin').style.display = 'none';
        document.getElementById('app-games').style.display = 'none';
        document.getElementById('app-profile').style.display = 'block';
        document.getElementById('sidebar').style.display = 'none';
        this.updateActiveNav('profile');

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
    }

    updateActiveNav(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
    }

    // ===== Переопределённые методы для навигации =====
    openAdmin() {
        this.router.navigate('/admin');
    }
     
    openProfileInfo() {
        this.router.navigate('/profile');
    }

    openGames() {
        this.router.navigate('/games');
    }

    // ===== Остальные методы (без изменений) =====
    // Они остаются как в предыдущей версии, за исключением замены вызовов модалок на роутер.
    // Для краткости я не дублирую их здесь, они уже есть в проекте.
    // Но важно: в методах setupMultiUserUI и setupEventListeners нужно заменить прямые вызовы
    // this.openAdmin() на this.router.navigate('/admin') и т.д.
    // Это уже сделано в предыдущем апдейте app.js.

    // Для полноты, повторю изменения в setupMultiUserUI:
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
            this.router.navigate('/admin');
        });
        
        // Кнопка открытия приватного чата
        document.getElementById('privateChatBtn')?.addEventListener('click', () => {
            this.openPrivateChat();
        });

        // Кнопка информации о пользователе
        document.getElementById('userProfileBtn')?.addEventListener('click', () => {
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