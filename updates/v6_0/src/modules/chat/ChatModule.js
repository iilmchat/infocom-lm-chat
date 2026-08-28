// src/modules/chat/ChatModule.js
/**
 * Модуль основного чата (работа с моделью ИИ)
 * Добавлено в 6.0
 * 
 * Содержит:
 * - Сайдбар (список диалогов)
 * - Основную область чата (ChatView)
 * - Управление сессиями, RAG, ассистентами
 * 
 * Этот модуль является основным и загружается при старте приложения.
 */
import { ChatView } from '../../ui/views/chat-view.js';
import { Sidebar } from '../../ui/views/sidebar.js';

export class ChatModule {
    constructor(app) {
        this.app = app;
        this.chatView = null;
        this.sidebar = null;
        this.container = document.getElementById('app-chat');
        
        // Проверяем, что контейнер существует
        if (!this.container) {
            console.error('Контейнер #app-chat не найден');
            return;
        }

        this.init();
    }

    /**
     * Инициализация модуля чата
     */
    init() {
        // Создаём экземпляры ChatView и Sidebar, передавая app
        // Они уже создаются в app.js, но теперь мы переносим создание сюда
        // Чтобы избежать дублирования, мы будем использовать уже созданные экземпляры,
        // но для чистоты архитектуры мы создадим их внутри модуля.
        // ВАЖНО: в app.js мы убираем прямые создания ChatView и Sidebar,
        // а вместо них используем этот модуль.

        // Создаём Sidebar
        this.sidebar = new Sidebar(this.app);
        // Создаём ChatView
        this.chatView = new ChatView(this.app);

        // Выполняем начальный рендеринг
        this.sidebar.render();
        this.chatView.render();

        // Подписываемся на события, которые требуют обновления UI
        this.setupEventListeners();

        console.log('✅ ChatModule инициализирован');
    }

    /**
     * Настройка событий, связанных с чатом
     */
    setupEventListeners() {
        // При переключении сессии обновляем интерфейс
        this.app.eventBus.on('session:switched', () => {
            this.sidebar.render();
            this.chatView.loadMessages();
            this.app.updateStats();
            this.app.updateRagFilesUI();
        });

        // При обновлении RAG перерисовываем статистику
        this.app.eventBus.on('rag:updated', () => {
            this.app.updateRagFilesUI();
            this.app.updateStats();
        });

        this.app.eventBus.on('rag:cleared', () => {
            this.app.updateRagFilesUI();
            this.app.updateStats();
        });

        // При подключении к серверу загружаем сообщения
        this.app.eventBus.on('server:connected', () => {
            this.chatView.loadMessages();
        });
    }

    /**
     * Показать модуль (показываем контейнер)
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    /**
     * Скрыть модуль
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Уничтожение модуля (очистка ресурсов)
     */
    destroy() {
        // Отписываемся от событий (если нужно)
        // В данном случае модуль живёт всё время, поэтому можно оставить пустым
        console.log('ChatModule уничтожен');
    }
}