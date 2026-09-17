// src/modules/chat/ChatModule.js
/**
 * Модуль основного чата (работа с моделью ИИ)
 * Добавлено в 6.0
 *
 * Изменено в 6.2:
 * - Убрано создание Sidebar (теперь Sidebar создаётся в App — KI-003, KI-013)
 * - ChatModule отвечает только за ChatView
 */
import { ChatView } from '../../ui/views/chat-view.js';

export class ChatModule {
    constructor(app) {
        this.app = app;
        this.chatView = null;
        this.container = document.getElementById('app-chat');

        if (!this.container) {
            console.error('Контейнер #app-chat не найден');
            return;
        }

        this.init();
    }

    init() {
        /* Изменено в 6.2: Sidebar больше здесь не создаётся (KI-003, KI-013) */
        this.chatView = new ChatView(this.app);

        /* Выполняем начальный рендеринг */
        this.chatView.render();

        this.setupEventListeners();

        console.log('✅ ChatModule инициализирован');
    }

    setupEventListeners() {
        /* При переключении сессии обновляем интерфейс */
        this.app.eventBus.on('session:switched', () => {
            this.app.sidebar.render();   /* Изменено в 6.2: явная ссылка на app.sidebar (KI-013) */
            this.chatView.loadMessages();
            this.app.updateStats();
            this.app.updateRagFilesUI();
        });

        this.app.eventBus.on('rag:updated', () => {
            this.app.updateRagFilesUI();
            this.app.updateStats();
        });

        this.app.eventBus.on('rag:cleared', () => {
            this.app.updateRagFilesUI();
            this.app.updateStats();
        });
    }

    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    destroy() {
        console.log('ChatModule уничтожен');
    }
}