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
import { DropZone } from './ui/components/drop-zone.js';
import sectionToggle from './ui/components/section-toggle.js';
import { SectionHelpers } from './utils/section-helpers.js';
import { UserModal } from './ui/views/user-modal.js';
import { AdminPanel } from './ui/views/admin-panel.js';
import { PrivateChat } from './ui/views/private-chat.js';



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

        this.userModal = new UserModal(this);
        this.adminPanel = new AdminPanel(this);
        this.privateChat = new PrivateChat(this);

        // Инициализация DropZone
        this.dropZone = new DropZone(this);
                
        // Инициализация секций
        this.initSections();

        // Загрузка и инициализация
        this.init();

        // Инициализация UI для многопользовательского режима
        this.setupMultiUserUI();
        this.updateUserCount();    

        // Подписка на события приватных чатов
        this.setupPrivateChatEvents();        
    }

    setupPrivateChatEvents() {
        // Событие открытия приватного чата
        this.eventBus.on('private:chat_opened', (data) => {
            const peer = this.multiUserManager.peers.get(data.user.id);
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

    // Переопределяем openPrivateChat
    async openPrivateChat(user) {
        if (!user) {
            // Если пользователь не передан, показываем список
            const users = this.multiUserManager.getAvailableUsers();
            if (users.length === 0) {
                this.toast.warning('Нет доступных пользователей');
                return;
            }
            // Показываем модалку выбора пользователя
            this.showUserSelector(users);
            return;
        }
        
        const chatId = await this.multiUserManager.openPrivateChat(user);
        if (chatId) {
            this.privateChat.open(user);
        }
    }

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
                        <div class="user-select-item" data-user-id="${u.id}" style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-radius:8px;transition:background 0.2s;border-bottom:1px solid var(--border-color);">
                            <span style="font-size:28px;">${u.avatar}</span>
                            <div>
                                <div style="font-weight:600;">${this.sanitizeHTML(u.name)}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${u.isTyping ? 'печатает...' : 'онлайн'}</div>
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
            this.openAdmin();
        });
        
        // Кнопка открытия приватного чата
        document.getElementById('privateChatBtn')?.addEventListener('click', () => {
            this.openPrivateChat();
        });


        // Кнопка информации о пользователе
        document.getElementById('userProfileBtn')?.addEventListener('click', () => {
            this.openProfileInfo();
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

    updateUserCount() {
        const count = this.multiUserManager.peers.size + 1;
        const display = document.getElementById('userCountDisplay');
        if (display) {
            display.textContent = `👥 ${count} онлайн`;
        }
        // Обновляем sidebar
        this.multiUserManager.renderUsers();
    }

    updateRoomInfoUI() {
        const status = this.multiUserManager.getStatus();
        document.getElementById('roomInfoId').textContent = status.roomId || '—';
        document.getElementById('roomInfoName').textContent = status.roomName || '—';
        document.getElementById('roomInfoUsers').textContent = status.userCount || 0;
        document.getElementById('roomInfoMessages').textContent = status.messageCount || 0;
        document.getElementById('roomInfoStatus').textContent = status.isConnected ? '🟢 Подключен' : '⚪ Отключен';
        document.getElementById('roomInfoStatus').style.color = status.isConnected ? 'var(--success-color)' : 'var(--text-secondary)';
    }

    openProfileInfo() {
        this.userModal.open();
        //document.getElementById('roomInfoModal').classList.add('active');
    }    

    openPrivateChat() {
        this.privateChat.open();
        //document.getElementById('roomInfoModal').classList.add('active');
    } 

    openAdmin() {
        this.adminPanel.open();
        //document.getElementById('roomInfoModal').classList.add('active');
    } 

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

        // Проверка сервера
        await this.apiService.checkServer();

        // Перерисовываем выпадающий список моделей
        this.renderModelDropdown(this);

        // Загрузка модели для текущего чата
        const model = this.sessionManager.getModelForChat();
        if (model) {
            this.currentModel = model;
            this.updateModelUI();            
        }

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
        this.setupEventListeners(this);

        this.toast.info(`🚀 Infocom LM Chat Pro v${CONFIG.VERSION}`, 2000);
        this.toast.info('💡 Используйте Ctrl+↑ и Ctrl+↓ для истории сообщений', 3000);
        this.toast.info('🚀 v5.0 — Multi-user, кастомные ассистенты, тесты!', 3000);

        console.log(`✅ Infocom LM Chat Pro v${CONFIG.VERSION}`);
        console.log('🛡️ XSS-защита: активна');
        console.log('♿ Доступность: ARIA + клавиатура');
        console.log('⚡ EventBus: активен');
    }

    /**
     * Остановка генерации
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
            // Если нет активного контроллера, но есть активные запросы в apiService
            if (this.apiService) {
                const aborted = this.apiService.abortAllRequests();
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

        // Глобальная обработка клавиш для отмены
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

        // Глобальный обработчик для кнопки смена тем
        const themeBtn = document.getElementById('themeBtn')
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                cycleTheme();
            });
        }
        

        // === ОБЩИЕ ПОДПИСКИ НА СОБЫТИЯ ДЛЯ МОДАЛЬНЫХ ОКЕН ===

        // Открытие модального окна "Поделиться"
        document.getElementById('shareBtn').onclick = app.openShareModal;

        // Закрытие модального окна "Поделиться" по кнопке закрытия
        document.getElementById('shareModalClose').onclick = () => {
            document.getElementById('shareModal').classList.remove('active');
        };

        // Закрытие модального окна "Поделиться" при клике вне области модалки
        document.getElementById('shareModal').onclick = (e) => {
            if (e.target === document.getElementById('shareModal')) {
                document.getElementById('shareModal').classList.remove('active');
            }
        };

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
    }


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
            shareHtml = `${window.app.multiUserManager.localUser.avatar} ${window.app.sanitizeHTML(window.app.multiUserManager.localUser.name)} (Вы)`;

            // Добавляем каждого подключенного пользователя в список
            window.app.multiUserManager.peers.forEach(peer => {
                shareHtml += `${peer.avatar} ${sanitizeHTML(peer.name)}`;
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

     renderModelDropdown(object) {
        const modelDropdown = document.getElementById('modelDropdown');
        const currentModelLabel = document.getElementById('currentModelLabel');                
        if (!object.apiService.availableModels.length) {
            modelDropdown.innerHTML = `<div class="model-item" style="color:var(--text-secondary);">Модели не найдены</div>`;
            return;
        }
        let html = '';
        object.apiService.availableModels.forEach(m => {
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
                    //-------------------------------------------
                    //БЫЛО УДАЛЕНО в 3.0, ЗАЧЕМ
                    //const s = sessionManager.getCurrent();
                    //if (s) s.model = currentModel;
                    //sessionManager.save();
                    //-------------------------------------------
                    object.toast.success(`Модель: ${object.currentModel}`);
                }
                modelDropdown.classList.remove('active');
            };
        });
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

    // Определяем все секции
    initSections() {
        // Определяем все секции
        const sectionConfigs = [
            { id: 'statsPanel', headerSelector: '[data-section="statsPanel"]' },
            { id: 'usersOnlinePanel', headerSelector: '[data-section="usersOnlinePanel"]' },
            { id: 'roadmapPanel', headerSelector: '[data-section="roadmapPanel"]' },
            { id: 'privateChatsPanel', headerSelector: '[data-section="privateChatsPanel"]' }
            
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

    /*
    initSections() {
        // Находим все секции и инициализируем их
        const sections = {
            statsPanel: {
                header: document.querySelector('.section-header[onclick*="statsPanel"]') || 
                        document.querySelector('#statsPanel')?.previousElementSibling,
                content: document.getElementById('statsPanel')
            },
            usersOnlinePanel: {
                header: document.querySelector('.section-header[onclick*="usersOnlinePanel"]') ||
                        document.querySelector('#usersOnlinePanel')?.previousElementSibling,
                content: document.getElementById('usersOnlinePanel')
            },
            roadmapPanel: {
                header: document.querySelector('.section-header[onclick*="roadmapPanel"]') ||
                        document.querySelector('#roadmapPanel')?.previousElementSibling,
                content: document.getElementById('roadmapPanel')
            }
        };

        // Инициализируем каждую секцию, которая существует
        Object.entries(sections).forEach(([id, { header, content }]) => {
            if (header && content) {
                // Добавляем data-атрибуты для идентификации
                header.dataset.section = id;
                sectionToggle.initSection(id, header, content);
            }
        });

        // Альтернативный способ: инициализация через data-атрибуты
        document.querySelectorAll('[data-section]').forEach(header => {
            const id = header.dataset.section;
            const content = document.getElementById(id);
            if (content) {
                sectionToggle.initSection(id, header, content);
            }
        });
    }

    */
}

// Запуск приложения
const app = new App();
window.app = app; // Для доступа из консоли (отладка)

export default app;