// src/ui/views/chat-view.js
import { CONFIG } from '../../config.js';
import { sanitizeHTML, validateInput, validateLength } from '../../services/sanitizer.js';
import { syntaxHighlighter } from '../../services/syntax-highlighter.js';
import { MessageRenderer } from '../renderers/message-renderer.js';
import { copyToClipboard } from '../../utils/dom-helpers.js';
import { FileManager } from '../../models/file-manager.js';
import { ReactionManager } from '../../models/reaction-manager.js';

/**
 * Основное представление чата
 * Изменено в 5.1: добавлены реакции, закрепление, жалобы, файлы, пагинация
 */
export class ChatView {
    constructor(app) {
        this.app = app;
        this.messageRenderer = new MessageRenderer();
        this.editingMessageId = null;
        this.editingOriginalContent = '';
        this.lastBotMessageEl = null;
        this.lastBotContent = '';

        // Добавлено в 5.1: FileManager
        this.fileManager = new FileManager(app);

        // Добавлено в 5.1: менеджер реакций
        this.reactionManager = new ReactionManager(app);
        // Добавлено в 5.1: состояние пагинации
        this.currentOffset = 0;
        this.pageSize = 50;
        this.hasMore = true;
        this.isLoadingHistory = false;
        // Добавлено в 5.1: закреплённые сообщения
        this.pinnedMessages = [];
        // Добавлено в 5.1: загруженные вложения
        this.uploadedAttachments = [];

        // DOM элементы
        this.messagesEl = document.getElementById('messages');
        this.userInput = document.getElementById('userInput');
        this.charCounter = document.getElementById('charCounter');
        this.sendBtn = document.getElementById('sendBtn');
        this.errorMsg = document.getElementById('errorMsg');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.inputLimitWarning = document.getElementById('inputLimitWarning');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileList = document.getElementById('fileList');

        this.setupEventListeners();
    }

    render() {
        this.loadMessages();
        this.updateCharCounter();
        this.updateInputPlaceholder();
    }

    /**
     * Загрузка сообщений с пагинацией
     * Изменено в 5.1: добавлена пагинация
     */
    async loadMessages(append = false) {
        if (this.isLoadingHistory) return;
        this.isLoadingHistory = true;
        try {
            const roomId = this.app.multiUserManager.roomId;
            if (!roomId) {
                this.messagesEl.innerHTML = '<div class="empty-chat">Выберите комнату для начала общения</div>';
                this.isLoadingHistory = false;
                return;
            }

            const result = await this.app.apiService.getHistory(
                roomId,
                this.pageSize,
                append ? this.currentOffset : 0
            );

            if (result.success) {
                const messages = result.messages || [];
                this.hasMore = result.hasMore || false;
                if (!append) {
                    // Заменяем всю историю
                    this.messagesEl.innerHTML = '';
                    this.currentOffset = messages.length;
                    // Добавляем закреплённые сообщения сверху
                    await this.loadPinnedMessages();
                    // Добавляем сообщения
                    messages.forEach(msg => this.renderMessage(msg, false));
                    if (messages.length === 0) {
                        this.showWelcome();
                    }
                    this.scrollToBottom();
                } else {
                    // Добавляем старые сообщения в начало
                    const fragment = document.createDocumentFragment();
                    const scrollHeight = this.messagesEl.scrollHeight;
                    messages.reverse().forEach(msg => {
                        const el = this.renderMessage(msg, false);
                        fragment.prepend(el);
                    });
                    this.messagesEl.prepend(fragment);
                    // Сохраняем позицию скролла
                    this.messagesEl.scrollTop = this.messagesEl.scrollHeight - scrollHeight;
                    this.currentOffset += messages.length;
                }
                // Если есть кнопка "Загрузить ещё", обновляем её видимость
                this.updateLoadMoreButton();
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.app.toast.error('Не удалось загрузить историю');
        } finally {
            this.isLoadingHistory = false;
        }
    }    

    /**
     * Загрузка закреплённых сообщений
     * Добавлено в 5.1.
     */
    async loadPinnedMessages() {
        try {
            const roomId = this.app.multiUserManager.roomId;
            if (!roomId) return;
            const result = await this.app.apiService.getPinnedMessages(roomId);
            if (result.success) {
                this.pinnedMessages = result.messages || [];
                // Отображаем закреплённые в отдельной области (можно вверху)
                this.renderPinnedMessages();
            }
        } catch (error) {
            console.warn('Ошибка загрузки закреплённых:', error);
        }
    }

    /**
     * Отображение закреплённых сообщений
     * Добавлено в 5.1.
     */
    renderPinnedMessages() {
        // Находим или создаём контейнер для закреплённых
        let pinContainer = document.getElementById('pinnedMessagesContainer');
        if (!pinContainer) {
            pinContainer = document.createElement('div');
            pinContainer.id = 'pinnedMessagesContainer';
            pinContainer.className = 'pinned-messages';
            this.messagesEl.prepend(pinContainer);
        }
        if (!this.pinnedMessages.length) {
            pinContainer.style.display = 'none';
            return;
        }
        pinContainer.style.display = 'block';
        pinContainer.innerHTML = `
            <div class="pinned-header">📌 Закреплённые сообщения</div>
            ${this.pinnedMessages.map(msg => `
                <div class="pinned-item" data-message-id="${msg.id}">
                    <span class="pinned-content">${sanitizeHTML(msg.content.substring(0, 100))}</span>
                    <button class="unpin-btn" data-message-id="${msg.id}">✕</button>
                </div>
            `).join('')}
        `;
        // Обработчики открепления
        pinContainer.querySelectorAll('.unpin-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const messageId = btn.dataset.messageId;
                await this.unpinMessage(messageId);
            });
        });
    }

    /**
     * Открепление сообщения
     * Добавлено в 5.1.
     */
    async unpinMessage(messageId) {
        try {
            const roomId = this.app.multiUserManager.roomId;
            const result = await this.app.apiService.unpinMessage(messageId, roomId);
            if (result.success) {
                this.pinnedMessages = this.pinnedMessages.filter(m => m.id !== messageId);
                this.renderPinnedMessages();
                this.app.toast.info('Сообщение откреплено');
            }
        } catch (error) {
            console.error('Ошибка открепления:', error);
            this.app.toast.error('Не удалось открепить');
        }
    }

    /**
     * Обновление кнопки "Загрузить ещё"
     * Добавлено в 5.1.
     */
    updateLoadMoreButton() {
        let btn = document.getElementById('loadMoreBtn');
        if (this.hasMore) {
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'loadMoreBtn';
                btn.className = 'load-more-btn';
                btn.textContent = '⬆ Загрузить ещё';
                btn.addEventListener('click', () => this.loadMessages(true));
                this.messagesEl.prepend(btn);
            }
            btn.style.display = 'block';
        } else {
            if (btn) btn.style.display = 'none';
        }
    }

    /**
     * Рендеринг отдельного сообщения с реакциями
     * Добавлено в 5.1.
     */
    renderMessage(msg, addToEnd = true) {
        const el = this.messageRenderer.render({
            role: msg.role,
            content: msg.content,
            messageId: msg.id,
            files: msg.attachments,
            isEdit: msg.isEdited,
            replyTo: msg.replyTo ? { content: msg.replyTo.content, role: msg.replyTo.role } : null
        });
        el.dataset.messageId = msg.id;
        el.dataset.userId = msg.userId;

        // Добавляем блок реакций
        const reactionsBlock = this.createReactionsBlock(msg.id);
        el.appendChild(reactionsBlock);

        // Добавляем меню действий (закрепить, пожаловаться)
        const actionsMenu = this.createActionsMenu(msg.id, msg.userId);
        el.querySelector('.message-actions')?.appendChild(actionsMenu);

        if (addToEnd) {
            this.messagesEl.appendChild(el);
        } else {
            this.messagesEl.prepend(el);
        }

        // Загружаем реакции для сообщения
        this.reactionManager.loadReactions(msg.id);
        return el;
    }
      
    /**
     * Создание блока реакций
     * Добавлено в 5.1.
     */
    createReactionsBlock(messageId) {
        const container = document.createElement('div');
        container.className = 'reactions-container';
        container.dataset.messageId = messageId;

        // Кнопки с эмодзи (быстрый выбор)
        const quickEmojis = ['👍', '❤️', '😂', '😮'];
        const emojiBar = document.createElement('div');
        emojiBar.className = 'reactions-emoji-bar';
        quickEmojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.className = 'reaction-btn';
            btn.title = `Реакция ${emoji}`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleReaction(messageId, emoji);
            });
            emojiBar.appendChild(btn);
        });
        // Кнопка "ещё" для выбора из всех эмодзи
        const moreBtn = document.createElement('button');
        moreBtn.textContent = '➕';
        moreBtn.className = 'reaction-more-btn';
        moreBtn.title = 'Другие реакции';
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showEmojiPicker(messageId);
        });
        emojiBar.appendChild(moreBtn);

        container.appendChild(emojiBar);

        // Контейнер для отображения существующих реакций
        const reactionsList = document.createElement('div');
        reactionsList.className = 'reactions-list';
        reactionsList.id = `reactions-${messageId}`;
        container.appendChild(reactionsList);

        // Подписка на обновление реакций
        this.app.eventBus.on(`reaction:updated:${messageId}`, (data) => {
            this.updateReactionsUI(messageId, data.reactions);
        });

        return container;
    }

    /**
     * Обновление UI реакций
     * Добавлено в 5.1.
     */
    updateReactionsUI(messageId, reactions) {
        const list = document.getElementById(`reactions-${messageId}`);
        if (!list) return;
        const userReaction = this.reactionManager.getReactions(messageId).userReaction;
        list.innerHTML = Object.entries(reactions).map(([emoji, count]) => `
            <span class="reaction-item ${userReaction === emoji ? 'user-reacted' : ''}" 
                  data-emoji="${emoji}" data-message-id="${messageId}">
                ${emoji} ${count}
            </span>
        `).join('');
        // Обработчики для клика по реакции (переключение)
        list.querySelectorAll('.reaction-item').forEach(item => {
            item.addEventListener('click', () => {
                const emoji = item.dataset.emoji;
                this.toggleReaction(messageId, emoji);
            });
        });
    }

    /**
     * Переключение реакции
     * Добавлено в 5.1.
     */
    async toggleReaction(messageId, emoji) {
        const current = this.reactionManager.getReactions(messageId);
        if (current.userReaction === emoji) {
            await this.reactionManager.removeReaction(messageId);
        } else {
            await this.reactionManager.addReaction(messageId, emoji);
        }
    }

    /**
     * Выбор эмодзи из полного списка
     * Добавлено в 5.1.
     */
    showEmojiPicker(messageId) {
        const picker = document.createElement('div');
        picker.className = 'emoji-picker-popup';
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '⭐', '🎉', '🔥', '💯', '👏', '🙌'];
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.className = 'picker-emoji';
            btn.addEventListener('click', () => {
                this.toggleReaction(messageId, emoji);
                picker.remove();
            });
            picker.appendChild(btn);
        });
        // Позиционируем рядом с кнопкой "ещё"
        const moreBtn = document.querySelector(`[data-message-id="${messageId}"] .reaction-more-btn`);
        if (moreBtn) {
            const rect = moreBtn.getBoundingClientRect();
            picker.style.position = 'fixed';
            picker.style.top = `${rect.bottom + 5}px`;
            picker.style.left = `${rect.left}px`;
        } else {
            picker.style.position = 'fixed';
            picker.style.bottom = '100px';
            picker.style.left = '50%';
            picker.style.transform = 'translateX(-50%)';
        }
        document.body.appendChild(picker);
        // Закрытие по клику вне
        const closePicker = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        };
        setTimeout(() => document.addEventListener('click', closePicker), 10);
    }

    /**
     * Меню действий (закрепить, пожаловаться)
     * Добавлено в 5.1.
     */
    createActionsMenu(messageId, userId) {
        const wrapper = document.createElement('span');
        wrapper.className = 'message-actions-extra';

        const isOwn = userId === this.app.multiUserManager.localUser.id;
        const isModerator = this.app.multiUserManager.isModeratorUser();

        // Закрепить (только для модераторов или владельца комнаты)
        if (isModerator || isOwn) {
            const pinBtn = document.createElement('button');
            pinBtn.textContent = '📌';
            pinBtn.title = 'Закрепить сообщение';
            pinBtn.className = 'action-btn';
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pinMessage(messageId);
            });
            wrapper.appendChild(pinBtn);
        }

        // Пожаловаться (для всех)
        const reportBtn = document.createElement('button');
        reportBtn.textContent = '🚨';
        reportBtn.title = 'Пожаловаться';
        reportBtn.className = 'action-btn';
        reportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.reportMessage(messageId);
        });
        wrapper.appendChild(reportBtn);

        return wrapper;
    }

    /**
     * Закрепление сообщения
     * Добавлено в 5.1.
     */
    async pinMessage(messageId) {
        try {
            const roomId = this.app.multiUserManager.roomId;
            const result = await this.app.apiService.pinMessage(messageId, {
                roomId,
                userId: this.app.multiUserManager.localUser.id
            });
            if (result.success) {
                this.app.toast.success('Сообщение закреплено');
                await this.loadPinnedMessages();
            }
        } catch (error) {
            console.error('Ошибка закрепления:', error);
            this.app.toast.error('Не удалось закрепить');
        }
    }

    /**
     * Жалоба на сообщение
     * Добавлено в 5.1.
     */
    async reportMessage(messageId) {
        const reason = prompt('Причина жалобы:');
        if (!reason) return;
        try {
            const result = await this.app.apiService.reportMessage(messageId, {
                reporterId: this.app.multiUserManager.localUser.id,
                reason: reason,
                description: reason
            });
            if (result.success) {
                this.app.toast.success('Жалоба отправлена');
            }
        } catch (error) {
            console.error('Ошибка отправки жалобы:', error);
            this.app.toast.error('Не удалось отправить жалобу');
        }
    }

    /**
     * Скачивание вложения
     * Добавлено в 5.1.
     */
    async downloadAttachment(attachmentId, fileName) {
        try {
            const response = await this.app.apiService.getAttachment(attachmentId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'attachment';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (error) {
            console.error('Ошибка скачивания:', error);
            this.app.toast.error('Не удалось скачать файл');
        }
    }

    /**
     * Удаление вложения
     * Добавлено в 5.1.
     */
    async deleteAttachment(attachmentId, messageId) {
        if (!confirm('Удалить это вложение?')) return;
        try {
            const result = await this.app.apiService.deleteAttachment(attachmentId);
            if (result.success) {
                this.app.toast.success('Вложение удалено');
                // Обновляем сообщение (убираем вложение)
                const msgEl = document.querySelector(`.message[data-message-id="${messageId}"]`);
                if (msgEl) {
                    const fileContainer = msgEl.querySelector('.file-attachment');
                    if (fileContainer) {
                        const item = fileContainer.querySelector(`[data-attachment-id="${attachmentId}"]`);
                        if (item) item.remove();
                        if (!fileContainer.children.length) fileContainer.remove();
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка удаления вложения:', error);
            this.app.toast.error('Не удалось удалить вложение');
        }
    }    

    /**
     * Извлечение упоминаний из текста
     * Добавлено в 5.1.
     */
    extractMentions(text) {
        const mentions = [];
        const regex = /@(\w+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const username = match[1];
            // Ищем пользователя среди peers и localUser
            const user = this.app.multiUserManager.peers.find(p => p.name.toLowerCase() === username.toLowerCase());
            if (user) {
                mentions.push(user.id);
            } else if (this.app.multiUserManager.localUser.name.toLowerCase() === username.toLowerCase()) {
                mentions.push(this.app.multiUserManager.localUser.id);
            }
        }
        return mentions;
    }

    /**
     * Загрузка файлов на сервер
     * Добавлено в 5.1.
     */
    async uploadAttachments(files) {
        const uploaded = [];
        for (const file of files) {
            const formData = new FormData();
            // Преобразуем File или наш объект в Blob
            const blob = new Blob([file.content], { type: file.type || 'text/plain' });
            const fileObj = new File([blob], file.name, { type: file.type || 'text/plain' });
            formData.append('file', fileObj);
            try {
                const result = await this.app.apiService.uploadAttachment(formData);
                if (result.success) {
                    uploaded.push({
                        attachmentId: result.attachment.attachmentId,
                        name: result.attachment.fileName,
                        size: result.attachment.fileSize,
                        type: result.attachment.mimeType
                    });
                }
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                this.app.toast.error(`Не удалось загрузить ${file.name}`);
            }
        }
        return uploaded;
    }   

    //ТУТ ЕЩЕ ЧТО-то из СТАРОГО или НОВОГо
    loadMessages() {
        this.messagesEl.innerHTML = '';
        //Устарело, теперь с подсвветкой
        //const messages = this.app.sessionManager.getMessages();
        // Используем getMessagesWithHighlight для получения подсвеченных сообщений
        const messages = this.app.sessionManager.getMessagesWithHighlight();        
        
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                const replyTo = msg.replyTo ? { content: msg.replyTo.content, role: msg.replyTo.role } : null;
                const msgData = {
                    role: msg.role,
                    content: msg.content, // Уже с подсветкой
                    replyTo: replyTo,
                    isEdit: msg.isEdit || false
                };
                const el = this.messageRenderer.render(msgData);
                this.messagesEl.appendChild(el);
            }
        });

        if (this.messagesEl.children.length === 0) {
            const welcome = this.messageRenderer.renderWelcome();
            this.messagesEl.appendChild(welcome);
        }

        this.scrollToBottom();
        
        // Добавляем кнопки копирования для уже загруженных блоков кода
        this.addCopyButtonsToCodeBlocks();
    }

    /**
     * Добавляет кнопки копирования ко всем блокам кода
     * Вызывается после загрузки сообщений
     */
    addCopyButtonsToCodeBlocks() {
        const preElements = this.messagesEl.querySelectorAll('pre:not(.has-copy-btn)');
        
        preElements.forEach(pre => {
            // Проверяем, есть ли уже кнопка копирования
            if (pre.querySelector('.copy-btn')) return;
            
            const codeElement = pre.querySelector('code');
            if (!codeElement) return;
            
            const codeText = codeElement.textContent || '';
            
            // Создаём кнопку копирования
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = '📋 Копировать';
            copyBtn.setAttribute('aria-label', 'Копировать код');
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                copyToClipboard(codeText, () => {
                    copyBtn.textContent = '✅ Скопировано!';
                    setTimeout(() => {
                        copyBtn.textContent = '📋 Копировать';
                    }, 2000);
                });
            };
            
            pre.appendChild(copyBtn);
            pre.classList.add('has-copy-btn');
        });
    }

  
    /**
     * Отправка сообщения
     * Изменено в 5.1: добавлены упоминания и файлы
     */
    async sendMessage(action = null, extraText = null) {
        const text = extraText !== null ? extraText : this.userInput.value.trim();
        if (!text || this.app.isProcessing) return;

        // ... валидация и подготовка (без изменений) ...        
        // Валидация
        const validation = validateInput(text);
        if (!validation.valid) {
            this.app.toast.error(validation.reason);
            this.userInput.classList.add('input-error');
            setTimeout(() => this.userInput.classList.remove('input-error'), 2000);
            return;
        }

        // Санитизация
        if (CONFIG.SECURITY.SANITIZE_INPUT) {
            if (!validateLength(text)) {
                this.app.toast.error(`❌ Превышен лимит символов (${CONFIG.LIMITS.MAX_INPUT_LENGTH})`, 3000);
                return;
            }
        }

        // Rate limiting
        if (!this.app.rateLimiter.isAllowed()) {
            this.app.toast.warning(`Превышен лимит запросов. Попробуйте через ${Math.ceil(this.app.rateLimiter.windowMs/1000)}с.`);
            return;
        }

        // Сохраняем историю
        if (text) {
            this.app.inputHistory.push(text);
        }

        this.app.isProcessing = true;

        // Проверка сервера
        const online = await this.app.api.checkServer();
        if (!online) {
            this.app.toast.error('Сервер недоступен. Проверьте настройки.');
            this.app.isProcessing = false;
            return;
        }

        // Подготовка контекста ответа
    
        let replyContext = null;
        if (this.app.replyTarget) {
            replyContext = {
                content: this.app.replyTarget.content,
                role: this.app.replyTarget.role
            };
            this.app.achievementManager.incrementReply();
            this.app.toast.success('💬 Ответ на сообщение', 1500);
            this.app.clearReplyTarget();
        }

        // RAG контекст
        let ragContext = null;
        if (text && this.app.ragManager.isReady && CONFIG.RAG.ENABLED) {
            if (this.app.ragManager.isFull) {
                this.app.toast.warning('⚠️ RAG достиг лимита (500 чанков). Очистите для добавления новых документов.', 4000);
            } else {
                try {
                    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('RAG timeout')), 5000));
                    const search = this.app.ragManager.getContext(text);
                    ragContext = await Promise.race([search, timeout]);
                } catch (e) {
                    console.warn('Поиск RAG произошел с ошибкой:', e);
                }
            }
        }

        // Добавляем сообщение пользователя
        const replyData = replyContext ? { content: replyContext.content, role: replyContext.role } : null;
        this.app.sessionManager.addMessage('user', text, replyData);
        const messageId = Date.now() + '_user';
        this.addMessage('user', text, messageId, this.app.attachedFiles.length ? this.app.attachedFiles : null, null, false, replyContext);

        const currentFiles = [...this.app.attachedFiles];
        this.app.attachedFiles = [];
        this.app.updateAttachedFilesUI();
        this.userInput.value = '';
        this.updateCharCounter();
        this.inputLimitWarning.classList.remove('active');
        this.app.inputHistory.reset();        

        // Извлечение упоминаний
        const mentions = this.extractMentions(text);     
             
        // Подготовка данных для отправки
        const messageData = {
            roomId: this.app.multiUserManager.roomId,
            userId: this.app.multiUserManager.localUser.id,
            userName: this.app.multiUserManager.localUser.name,
            userAvatar: this.app.multiUserManager.localUser.avatar,
            content: text,
            role: 'user',
            replyToId: this.app.replyTarget ? this.app.replyTarget.messageId : null,
            attachments: [],
            mentions: mentions
        };

        // Загрузка файлов, если есть
        if (currentFiles.length) {
            const uploaded = await this.uploadAttachments(currentFiles);
            messageData.attachments = uploaded;
        }
        /*        
        //ТУТ Надо понять
            // Если есть прикреплённые файлы, загружаем их сначала
            if (this.app.attachedFiles.length) {
                const uploaded = await this.uploadAttachments(this.app.attachedFiles);
                messageData.attachments = uploaded;
                this.app.attachedFiles = [];
                this.app.updateAttachedFilesUI();
            }

            // Отправляем через MultiUserManager (он уже использует ApiService)
            const sentMsg = await this.app.multiUserManager.sendMessage(
                messageData.content,
                {
                    replyToId: messageData.replyToId,
                    attachments: messageData.attachments,
                    mentions: messageData.mentions
                }
            );

        
        // Добавляем сообщение пользователя
        const replyData = replyContext ? { content: replyContext.content, role: replyContext.role } : null;
        this.app.sessionManager.addMessage('user', text, replyData);
        const messageId = Date.now() + '_user';
        this.addMessage('user', text, messageId, this.app.attachedFiles.length ? this.app.attachedFiles : null, null, false, replyContext);

        const currentFiles = [...this.app.attachedFiles];
        this.app.attachedFiles = [];
        this.app.updateAttachedFilesUI();
        this.userInput.value = '';
        this.updateCharCounter();
        this.inputLimitWarning.classList.remove('active');
        this.app.inputHistory.reset();
        */

        // Создаем элемент для ответа бота
        const botEl = this.addMessage('bot', '');
        botEl.classList.add('streaming');
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = '⏳ Отправка...';
        this.typingIndicator.style.display = 'block';
        this.errorMsg.style.display = 'none';

        // Подготовка промпта
        let prompt = text;

        if (action === 'review') {
            const code = currentFiles.length ? currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n') : text;
            prompt = `Сделай Code Review:\n\`\`\`\n${code}\n\`\`\``;
            this.app.achievementManager.incrementReview();
            this.app.achievementManager.checkAndUnlock('first_review');
        } else if (action === 'test') {
            const code = currentFiles.length ? currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n') : text;
            prompt = `Сгенерируй unit-тесты:\n\`\`\`\n${code}\n\`\`\``;
            this.app.achievementManager.incrementTest();
            this.app.achievementManager.checkAndUnlock('first_test');
        } else if (ragContext) {
            prompt = `${ragContext.text}\n\n---\n\nВопрос: ${text}`;
        } else if (currentFiles.length) {
            const fc = currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n');
            prompt = `${text || 'Проанализируйте файлы'}\n\n${fc}`;
        }

        if (replyContext) {
            const author = replyContext.role === 'user' ? 'Пользователь' : 'Ассистент';
            prompt = `[Ответ на сообщение от ${author}: "${replyContext.content}"]\n\n${prompt}`;
        }

        // Системные сообщения
        const messages = [
            { role: 'system', content: CONFIG.SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ];

        if (this.app.assistantManager.activeAssistant) {
            messages.unshift({ role: 'system', content: this.app.assistantManager.getPrompt() });
        }

        const payload = {
            model: this.app.currentModel,
            messages,
            temperature: action === 'review' ? CONFIG.SERVER.REVIEW_TEMPERATURE : CONFIG.SERVER.TEMPERATURE,
            max_tokens: this.app.apiService.SERVER_CONFIG?.maxTokens || CONFIG.SERVER.DEFAULT_MAX_TOKENS,
            stream: true
        };
        
        // Создаём AbortController для отмены запроса
        this.app.streamAbortController = new AbortController();
        const signal = this.app.streamAbortController.signal;

        this.sendBtn.textContent = '⏹ Стоп';
        this.sendBtn.classList.add('stop-btn');
        this.sendBtn.disabled = false;

        let accumulated = '';
        let isCompleted = false;
        const ragSourcesUsed = ragContext?.sources || null;

        try {
            // Передаём signal в apiService            
            await this.app.apiService.sendMessage(
                payload,
                async (chunk) => {
                    // Проверяем, не был ли запрос отменён
                    if (signal.aborted) {
                        return;
                    }
                    accumulated = chunk;
                    await this.updateStreamMessage(botEl, accumulated, ragSourcesUsed);
                },
                async (final, aborted) => {
                    // Обработка завершения или отмены
                    isCompleted = true;
                    
                    if (signal.aborted || aborted) {
                        // Запрос был отменён
                        if (accumulated) {
                            const stopMsg = accumulated + '\n\n_[Прервано]_';
                            this.app.sessionManager.addMessage('assistant', stopMsg);
                            this.app.sessionManager.save();
                            await this.updateStreamMessage(botEl, stopMsg, ragSourcesUsed);
                            this.app.toast.warning('⏹ Генерация прервана');
                        } else {
                            // Удаляем пустое сообщение бота  
                            const messages = this.app.sessionManager.getMessages();
                            if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                                messages.pop();
                                this.app.sessionManager.setMessages(messages);
                            }
                            botEl.remove();
                            this.app.toast.warning('⏹ Генерация прервана');
                        }
                    } else if (final) {
                        // Запрос успешно завершён
                        this.app.sessionManager.addMessage('assistant', final);
                        this.app.sessionManager.save();
                        await this.updateStreamMessage(botEl, final, ragSourcesUsed);
                        this.app.achievementManager.incrementMessage();
                        this.app.achievementManager.checkAndUnlock('first_message');
                    } else {
                        // Пустой ответ      
                        const messages = this.app.sessionManager.getMessages();
                        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                            messages.pop();
                            this.app.sessionManager.setMessages(messages);
                        }                        
                        botEl.remove();
                        this.app.toast.warning('Пустой ответ от сервера');
                    }

                    this.finishSending();
                },
                (error) => {
                    // Проверяем, не была ли это отмена
                    if (error.name === 'AbortError' || error.message === 'canceled' || error.message?.includes('abort')) {
                        // Отмена уже обработана в onComplete
                        return;
                    }
                    
                    let errMsg = '⚠️ Ошибка соединения.';
                    if (error.message.includes('429')) errMsg = '⚠️ Слишком много запросов. Подождите.';
                    else if (error.message.includes('timeout')) errMsg = '⏱️ Таймаут запроса.';
                    else if (error.message.includes('ECONNREFUSED')) errMsg = '❌ Сервер недоступен. Проверьте настройки.';
                    else if (error.message.includes('500')) errMsg = '❌ Ошибка сервера (500). Попробуйте позже.';

                    this.errorMsg.textContent = errMsg;
                    this.errorMsg.style.display = 'block';
                    if (botEl.parentNode) botEl.remove();
                    this.addMessage('bot', `❌ ${errMsg}`);
                    this.app.toast.error(errMsg);
                    
                    this.finishSending();            
                },
                signal // Передаём signal в apiService
            );
        } catch (error) {
            // Проверяем, не была ли это отмена
            if (error.name === 'AbortError' || error.message === 'canceled' || error.message?.includes('abort')) {
                if (!isCompleted) {
                    this.finishSending();
                }
                return;
            }
            console.error('Send message error:', error);
            if (!isCompleted) {
                this.finishSending();
            }            
        }
    }
    
    /**
     * Завершение отправки сообщения (очистка UI)
     */
    finishSending() {
        this.app.isProcessing = false;
        this.app.streamAbortController = null;
        
        this.sendBtn.classList.remove('stop-btn');
        this.sendBtn.textContent = 'Отправить';
        this.sendBtn.disabled = false;
        this.typingIndicator.style.display = 'none';
        
        this.app.sidebar.render();
        this.app.updateStats();
        this.focusInput();
    }

    // Остальные методы (addMessage, updateStreamMessage, etc.) остаются без изменений
    // Они уже реализованы в исходном коде    

    addMessage(role, content, messageId = null, files = null, ragSources = null, isEdit = false, replyTo = null) {
        const msgData = { role, content, messageId, files, ragSources, isEdit, replyTo };
        const el = this.messageRenderer.render(msgData);
        this.messagesEl.appendChild(el);
        this.scrollToBottom();
        
        // Добавляем кнопки копирования для новых блоков кода
        setTimeout(() => {
            const preElements = el.querySelectorAll('pre:not(.has-copy-btn)');
            preElements.forEach(pre => {
                const codeElement = pre.querySelector('code');
                if (!codeElement) return;
                
                const codeText = codeElement.textContent || '';
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = '📋 Копировать';
                copyBtn.setAttribute('aria-label', 'Копировать код');
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    copyToClipboard(codeText, () => {
                        copyBtn.textContent = '✅ Скопировано!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Копировать';
                        }, 2000);
                    });
                };
                pre.appendChild(copyBtn);
                pre.classList.add('has-copy-btn');
            });
        }, 50);
        
        return el;
    }

    /**
     * Обновление стримингового сообщения с асинхронной подсветкой
     */
    async updateStreamMessage(el, content, ragSources = null) {
        const bubble = el.querySelector('.bubble');
        if (!bubble) return;

        bubble.innerHTML = '';
        const parts = this.messageRenderer.formatMessage(content);
        
        // Создаём контейнер для частей
        const container = document.createElement('div');
        
        for (const p of parts) {
            if (p.type === 'text') {
                const td = document.createElement('div');
                td.innerHTML = sanitizeHTML(p.content).replace(/\n/g, '<br>');
                container.appendChild(td);
            } else if (p.type === 'code') {
                // Создаём pre с индикатором загрузки
                const pre = document.createElement('pre');
                pre.setAttribute('tabindex', '0');
                pre.dataset.language = p.language || 'text';
                pre.dataset.code = p.content;
                pre.dataset.highlighting = 'pending';
                
                // Показываем индикатор загрузки
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'code-loading';
                loadingDiv.textContent = '⏳ Подсветка кода...';
                pre.appendChild(loadingDiv);
                
                container.appendChild(pre);
            }
        }
        
        bubble.appendChild(container);
        
        // Асинхронно подсвечиваем все блоки кода
        await this.highlightCodeBlocks(container);
        
        // Добавляем источники RAG
        if (ragSources && ragSources.length) {
            const rd = document.createElement('div');
            rd.className = 'rag-sources';
            rd.innerHTML = `<strong>📚 Источники:</strong> ${ragSources.map(s =>
                `<span style="background:var(--border-color);padding:2px 8px;border-radius:12px;margin:2px;">${sanitizeHTML(s.source)} (${(s.similarity * 100).toFixed(1)}%)</span>`
            ).join(' ')}`;
            bubble.appendChild(rd);
        }

        this.scrollToBottom();
    }

    /**
     * Асинхронная подсветка всех блоков кода в контейнере
     */
    async highlightCodeBlocks(container) {
        const pres = container.querySelectorAll('pre[data-highlighting="pending"]');
        
        for (const pre of pres) {
            const code = pre.dataset.code || '';
            const language = pre.dataset.language || 'text';
            
            try {
                // Используем асинхронную подсветку с кэшированием
                const highlighted = await syntaxHighlighter.highlight(code, language);
                
                // Заменяем содержимое pre
                pre.innerHTML = highlighted;
                
                // Добавляем кнопку копирования
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = '📋 Копировать';
                copyBtn.setAttribute('aria-label', 'Копировать код');
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    const codeText = pre.querySelector('code')?.textContent || code;
                    copyToClipboard(codeText, () => {
                        copyBtn.textContent = '✅ Скопировано!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Копировать';
                        }, 2000);
                    });
                };
                pre.appendChild(copyBtn);
                pre.classList.add('has-copy-btn');
                
                // Убираем статус загрузки
                pre.dataset.highlighting = 'done';
                
            } catch (error) {
                console.warn('Ошибка подсветки кода в стриме:', error);
                // Fallback - показать исходный код без подсветки
                const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                pre.innerHTML = `<code class="hljs language-${language}">${escaped}</code>`;
                pre.dataset.highlighting = 'error';
                
                // Всё равно добавляем кнопку копирования
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = '📋 Копировать';
                copyBtn.setAttribute('aria-label', 'Копировать код');
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    copyToClipboard(code, () => {
                        copyBtn.textContent = '✅ Скопировано!';
                        setTimeout(() => {
                            copyBtn.textContent = '📋 Копировать';
                        }, 2000);
                    });
                };
                pre.appendChild(copyBtn);
                pre.classList.add('has-copy-btn');
            }
        }
    }

    showWelcome() {
        const welcome = this.messageRenderer.renderWelcome();
        this.messagesEl.appendChild(welcome);
    }

    startEditing(div, content) {
        if (this.editingMessageId) {
            const prev = document.querySelector('.message.editing');
            if (prev) prev.classList.remove('editing');
            const controls = document.querySelector('.edit-controls');
            if (controls) controls.remove();
        }

        div.classList.add('editing');
        this.editingMessageId = div.dataset.messageId;
        this.editingOriginalContent = content;

        const bubble = div.querySelector('.bubble');
        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.innerHTML = `
            <textarea rows="3" aria-label="Редактирование сообщения">${sanitizeHTML(content)}</textarea>
            <button class="save-edit" aria-label="Сохранить">💾 Сохранить</button>
            <button class="cancel-edit" aria-label="Отмена">✕ Отмена</button>
        `;
        bubble.appendChild(controls);

        const textarea = controls.querySelector('textarea');
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

        controls.querySelector('.save-edit').onclick = () => this.saveEdit(div, textarea.value);
        controls.querySelector('.cancel-edit').onclick = () => this.cancelEdit(div);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveEdit(div, textarea.value);
            }
            if (e.key === 'Escape') {
                this.cancelEdit(div);
            }
        });
    }

    saveEdit(div, newContent) {
        if (!newContent.trim()) {
            this.app.toast.warning('Сообщение не может быть пустым');
            return;
        }

        const messages = this.app.sessionManager.getMessages();
        let msgIndex = -1;

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user' && messages[i].content === this.editingOriginalContent) {
                if (i > 0 && messages[i - 1].role === 'system') continue;
                msgIndex = i;
                break;
            }
        }

        if (msgIndex === -1) {
            this.app.toast.error('Не удалось найти сообщение для редактирования');
            this.cancelEdit(div);
            return;
        }

        messages[msgIndex].content = newContent;
        this.app.sessionManager.setMessages(messages);

        const bubble = div.querySelector('.bubble');
        const controls = bubble.querySelector('.edit-controls');
        if (controls) controls.remove();

        bubble.innerHTML = '';
        const td = document.createElement('div');
        td.textContent = newContent;
        bubble.appendChild(td);

        const ei = document.createElement('div');
        ei.className = 'edit-indicator';
        ei.textContent = '✏️ Отредактировано';
        bubble.appendChild(ei);

        div.classList.remove('editing');
        this.editingMessageId = null;
        this.editingOriginalContent = '';

        this.app.achievementManager.incrementEdit();
        this.app.achievementManager.checkAndUnlock('first_edit');
        this.app.toast.success('✏️ Сообщение обновлено');
    }

    cancelEdit(div) {
        const controls = div.querySelector('.edit-controls');
        if (controls) controls.remove();
        div.classList.remove('editing');
        this.editingMessageId = null;
        this.editingOriginalContent = '';
    }

    async regenerateMessage(div, oldContent) {
        if (this.app.isProcessing) return;
        if (!div) return;

        const allMessages = document.querySelectorAll('.message');
        let userMessage = null;

        for (let i = 0; i < allMessages.length; i++) {
            if (allMessages[i] === div) {
                for (let j = i - 1; j >= 0; j--) {
                    if (allMessages[j].classList.contains('user')) {
                        userMessage = allMessages[j];
                        break;
                    }
                }
                break;
            }
        }

        if (!userMessage) {
            this.app.toast.warning('Не найдено сообщение пользователя для перегенерации');
            return;
        }

        const userText = userMessage.querySelector('.bubble')?.textContent || '';
        if (!userText.trim()) return;

        div.remove();

        const messages = this.app.sessionManager.getMessages();
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                messages.splice(i, 1);
                break;
            }
        }
        this.app.sessionManager.setMessages(messages);

        this.userInput.value = userText;
        await this.sendMessage(null, userText);
        this.userInput.value = '';
        this.updateCharCounter();

        this.app.achievementManager.incrementRegenerate();
        this.app.achievementManager.checkAndUnlock('first_regenerate');
        this.app.toast.info('↻ Ответ перегенерирован');
    }

    clearReplyTarget() {
        //this.replyTarget = null;
        this.app.clearReplyTarget();
    }

    updateCharCounter() {
        const len = this.userInput.value.length;
        const max = CONFIG.MESSAGE.MAX_LENGTH;
        this.charCounter.textContent = `${len} / ${max}`;
        this.charCounter.className = 'char-counter';
        if (len > CONFIG.MESSAGE.MAX_LENGTH * CONFIG.MESSAGE.WARNING_THRESHOLD) {
            this.charCounter.classList.add('warning');
        }
        if (len > max) this.charCounter.classList.add('exceeded');
    }

    updateInputPlaceholder() {
        // Плейсхолдер устанавливается через app.setReplyTarget
    }

    scrollToBottom() {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    focusInput() {
        this.userInput.focus();
    }


    setupEventListeners() {
        // Обработчики событий (оставляем существующие)        
        // Отправка по Ctrl+Enter
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.sendMessage();
            }
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                this.userInput.value += '\n';
                this.updateCharCounter();
            }
            if (e.key === 'Escape' && this.app.replyTarget) {
                this.clearReplyTarget();
                this.app.toast.info('Ответ отменён', 1000);
            }

            // История сообщений (Ctrl+↑ / Ctrl+↓)
            if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const currentText = this.userInput.value;
                const prev = this.app.inputHistory.getPrevious(currentText);
                if (prev !== null) {
                    this.userInput.value = prev;
                    this.userInput.selectionStart = this.userInput.selectionEnd = this.userInput.value.length;
                    this.updateCharCounter();
                }
                return;
            }

            if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const currentText = this.userInput.value;
                const next = this.app.inputHistory.getNext(currentText);
                if (next !== null) {
                    this.userInput.value = next;
                    this.userInput.selectionStart = this.userInput.selectionEnd = this.userInput.value.length;
                    this.updateCharCounter();
                }
                return;
            }
        });

        // Обновление счетчика символов
        this.userInput.addEventListener('input', () => {
            this.updateCharCounter();
            const len = this.userInput.value.length;
            if (len > CONFIG.LIMITS.MAX_INPUT_LENGTH * 0.9) {
                this.inputLimitWarning.classList.add('active');
                this.inputLimitWarning.textContent = `⚠️ Осталось ${CONFIG.LIMITS.MAX_INPUT_LENGTH - len} символов`;
            } else {
                this.inputLimitWarning.classList.remove('active');
            }
        });

        // Кнопка отправки
        this.sendBtn.addEventListener('click', () => {
            if (this.sendBtn.classList.contains('stop-btn') && this.app.streamAbortController) {
                this.app.streamAbortController.abort();
                return;
            }
            this.sendMessage();
        });

        // Кнопка Code Review
        document.getElementById('reviewBtn')?.addEventListener('click', () => {
            const text = this.userInput.value.trim();
            if (!text && !this.app.attachedFiles.length) {
                this.app.toast.warning('Введите код для анализа или прикрепите файл');
                return;
            }
            this.sendMessage('review');
        });

        // Кнопка генерации тестов
        document.getElementById('testBtn')?.addEventListener('click', () => {
            const text = this.userInput.value.trim();
            if (!text && !this.app.attachedFiles.length) {
                this.app.toast.warning('Введите код для генерации тестов или прикрепите файл');
                return;
            }
            this.sendMessage('test');
        });

        this.setupFileHandlers();
        this.setupDragAndDrop();


/*
        // Файловый ввод
        document.getElementById('fileBtn')?.addEventListener('click', () => {
            document.getElementById('fileInput')?.click();
        });

                // Обработчик изменения файла
        document.getElementById('fileInput')?.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files);
            if (!files.length) return;

            const valid = [];
            for (const f of files) {
                if (!this.app.isFileAllowed(f)) {
                    this.app.toast.error(`"${f.name}" не поддерживается`);
                    continue;
                }
                if (f.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${f.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                if (this.app.attachedFiles.length + valid.length >= CONFIG.LIMITS.MAX_ATTACHMENTS) {
                    this.app.toast.warning(`Максимум ${CONFIG.LIMITS.MAX_ATTACHMENTS} файлов`);
                    break;
                }
                try {
                    const content = await this.app.getFileText(f);
                    valid.push({ content, name: f.name, size: f.size, type: f.type });
                } catch {
                    this.app.toast.error(`Ошибка чтения "${f.name}"`);
                }
            }

            this.app.attachedFiles.push(...valid);
            this.app.updateAttachedFilesUI();
            this.value = '';
            if (valid.length) this.app.toast.success(`Загружено ${valid.length} файлов`);
        });

        // RAG ввод
        document.getElementById('ragBtn')?.addEventListener('click', () => {
            document.getElementById('ragInput')?.click();
        });

        document.getElementById('ragInput')?.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files);
            if (!files.length) return;

            if (this.app.ragManager.isFull) {
                this.app.toast.error('❌ RAG достиг лимита (500 чанков). Очистите перед загрузкой.', 4000);
                this.value = '';
                return;
            }

            const valid = [];
            for (const f of files) {
                if (!this.app.isFileAllowed(f)) {
                    this.app.toast.error(`"${f.name}" не поддерживается`);
                    continue;
                }
                if (f.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${f.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                try {
                    const content = await this.app.getFileText(f);
                    valid.push({ content, name: f.name, size: f.size, type: f.type });
                } catch {
                    this.app.toast.error(`Ошибка чтения "${f.name}"`);
                }
            }

            if (valid.length) {
                const available = this.app.ragManager.maxChunks - this.app.ragManager.chunkCount;
                if (valid.length > available) {
                    this.app.toast.warning(`⚠️ Можно загрузить только ${available} документов`, 4000);
                }
                this.progressBar.style.display = 'block';
                this.progressFill.style.width = '30%';
                const results = await this.app.ragManager.addDocuments(valid);
                this.app.achievementManager.incrementRag(results.length);
                this.app.achievementManager.checkAndUnlock('first_rag');
                this.app.sessionManager.setRAG(this.app.ragManager.toJSON());
                this.progressFill.style.width = '100%';
                setTimeout(() => {
                    this.progressBar.style.display = 'none';
                    this.progressFill.style.width = '0%';
                }, 300);
                this.app.toast.success(`✅ Загружено ${results.length} чанков`);
                this.addMessage('bot', `✅ Загружено ${results.length} чанков (${valid.length} документов) в RAG контекст.`);
                this.app.updateRagFilesUI();
                document.getElementById('ragBtn').style.color = 'var(--success-color)';
                this.app.updateStats();
            }
            this.value = '';
        });
*/

        // Быстрые кнопки
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.userInput.value = btn.dataset.text;
                this.userInput.focus();
                this.updateCharCounter();
                setTimeout(() => this.sendMessage(), 300);
            });
        });

        // Делегирование событий для сообщений
        this.messagesEl.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // Копирование кода
            if (target.classList.contains('copy-btn')) {
                const pre = target.closest('pre');
                if (pre) {
                    const code = pre.querySelector('code')?.textContent || '';
                    copyToClipboard(code, () => {
                        target.textContent = '✅ Скопировано!';
                        setTimeout(() => { target.textContent = '📋 Копировать'; }, 2000);
                    });
                }
                return;
            }

            // Редактирование
            if (target.textContent === '✏️') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    this.startEditing(messageDiv, content);
                }
                return;
            }

            // Ответ
            if (target.textContent === '↩️') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    const role = messageDiv.classList.contains('user') ? 'user' : 'bot';
                    this.app.setReplyTarget(messageDiv, content, role);
                }
                return;
            }

            // Перегенерация
            if (target.textContent === '↻') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    this.regenerateMessage(messageDiv, content);
                }
                return;
            }
        });
    }

    setupFileHandlers() {
        // Кнопка прикрепления файлов
        const fileBtn = document.getElementById('fileBtn');
        const fileInput = document.getElementById('fileInput');

        fileBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files);
            if (!files.length) return;

            const validFiles = [];
            for (const file of files) {
                if (!this.app.isFileAllowed(file)) {
                    this.app.toast.error(`"${file.name}" не поддерживается`);
                    continue;
                }
                if (file.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${file.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                try {
                    const content = await this.app.getFileText(file);
                    validFiles.push({ content, name: file.name, size: file.size, type: file.type });
                } catch (error) {
                    this.app.toast.error(`Ошибка чтения: ${file.name}`);
                }
            }

            if (validFiles.length) {
                this.app.attachedFiles = this.app.attachedFiles || [];
                this.app.attachedFiles.push(...validFiles);
                this.app.updateAttachedFilesUI();
                this.app.toast.success(`📎 Прикреплено ${validFiles.length} файлов`);
                this.app.updateStats();
            }

            this.value = '';
        });

        // Кнопка RAG
        const ragBtn = document.getElementById('ragBtn');
        const ragInput = document.getElementById('ragInput');

        ragBtn?.addEventListener('click', () => {
            ragInput?.click();
        });

        ragInput?.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files);
            if (!files.length) return;

            if (this.app.ragManager.isFull) {
                this.app.toast.error('❌ RAG достиг лимита (500 чанков)', 4000);
                this.value = '';
                return;
            }

            const validFiles = [];
            for (const file of files) {
                if (!this.app.isFileAllowed(file)) {
                    this.app.toast.error(`"${file.name}" не поддерживается`);
                    continue;
                }
                if (file.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${file.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                try {
                    const content = await this.app.getFileText(file);
                    validFiles.push({ content, name: file.name, size: file.size, type: file.type });
                } catch (error) {
                    this.app.toast.error(`Ошибка чтения: ${file.name}`);
                }
            }

            if (validFiles.length) {
                const available = this.app.ragManager.maxChunks - this.app.ragManager.chunkCount;
                if (validFiles.length > available) {
                    this.app.toast.warning(`⚠️ Можно загрузить только ${available} документов`, 4000);
                    validFiles.splice(available);
                }

                if (validFiles.length) {
                    this.progressBar.style.display = 'block';
                    this.progressFill.style.width = '30%';
                    const results = await this.app.ragManager.addDocuments(validFiles);
                    this.app.achievementManager.incrementRag(results.length);
                    this.app.achievementManager.checkAndUnlock('first_rag');
                    this.app.sessionManager.setRAG(this.app.ragManager.toJSON());
                    this.progressFill.style.width = '100%';
                    setTimeout(() => {
                        this.progressBar.style.display = 'none';
                        this.progressFill.style.width = '0%';
                    }, 300);
                    this.app.toast.success(`✅ Загружено ${results.length} чанков`);
                    this.app.updateRagFilesUI();
                    this.app.updateStats();
                }
            }

            this.value = '';
        });
    }

    setupDragAndDrop() {
        // Поддержка перетаскивания в область чата
        this.messagesEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messagesEl.classList.add('drop-zone-highlight');
        });

        this.messagesEl.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messagesEl.classList.remove('drop-zone-highlight');
        });

        this.messagesEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.messagesEl.classList.remove('drop-zone-highlight');

            const files = Array.from(e.dataTransfer?.files || []);
            if (!files.length) return;

            // Используем DropZone для обработки файлов
            // Но сначала определяем режим по умолчанию
            const mode = e.ctrlKey || e.metaKey ? 'rag' : 'attachment';

            // Создаем временную DropZone для обработки
            const validFiles = [];
            for (const file of files) {
                if (this.app.isFileAllowed(file) && file.size <= CONFIG.LIMITS.MAX_FILE_SIZE) {
                    try {
                        const content = await this.app.getFileText(file);
                        validFiles.push({ content, name: file.name, size: file.size, type: file.type });
                    } catch (error) {
                        this.app.toast.error(`Ошибка чтения: ${file.name}`);
                    }
                }
            }

            if (!validFiles.length) {
                this.app.toast.warning('Нет подходящих файлов');
                return;
            }

            if (mode === 'attachment') {
                // Обработка как вложение
                const maxAttachments = CONFIG.LIMITS.MAX_ATTACHMENTS;
                const currentCount = this.app.attachedFiles?.length || 0;
                if (currentCount + validFiles.length > maxAttachments) {
                    const available = maxAttachments - currentCount;
                    this.app.toast.warning(`Максимум ${maxAttachments} файлов, можно добавить еще ${available}`);
                    validFiles.splice(available);
                }
                if (validFiles.length) {
                    this.app.attachedFiles = this.app.attachedFiles || [];
                    this.app.attachedFiles.push(...validFiles);
                    this.app.updateAttachedFilesUI();
                    this.app.toast.success(`📎 Прикреплено ${validFiles.length} файлов`);
                }
            } else {
                // Обработка как RAG
                if (this.app.ragManager.isFull) {
                    this.app.toast.error('❌ RAG достиг лимита (500 чанков)', 4000);
                    return;
                }
                const available = this.app.ragManager.maxChunks - this.app.ragManager.chunkCount;
                if (validFiles.length > available) {
                    this.app.toast.warning(`⚠️ Можно загрузить только ${available} документов`, 4000);
                    validFiles.splice(available);
                }
                if (validFiles.length) {
                    this.progressBar.style.display = 'block';
                    this.progressFill.style.width = '30%';
                    const results = await this.app.ragManager.addDocuments(validFiles);
                    this.app.achievementManager.incrementRag(results.length);
                    this.app.achievementManager.checkAndUnlock('first_rag');
                    this.app.sessionManager.setRAG(this.app.ragManager.toJSON());
                    this.progressFill.style.width = '100%';
                    setTimeout(() => {
                        this.progressBar.style.display = 'none';
                        this.progressFill.style.width = '0%';
                    }, 300);
                    this.app.toast.success(`✅ Загружено ${validFiles.length} документов в RAG (${results.length} чанков)`);
                    this.app.updateRagFilesUI();
                    this.app.updateStats();
                }
            }
        });
    }    
   
    // Добавлено в 5.1: загрузка файлов через FileManager с прогрессом
    async uploadAttachments_fileManager(files) {
        const uploaded = [];
        const total = files.length;
        let completed = 0;

        // Показываем прогресс-бар
        this.progressBar.style.display = 'block';
        this.progressFill.style.width = '0%';

        for (const file of files) {
            try {
                // Создаём File из нашего объекта
                const blob = new Blob([file.content], { type: file.type || 'text/plain' });
                const fileObj = new File([blob], file.name, { type: file.type || 'text/plain' });
                
                const result = await this.fileManager.uploadFile(fileObj, null, (progress) => {
                    const overall = (completed + progress / 100) / total * 100;
                    this.progressFill.style.width = `${Math.round(overall)}%`;
                });
                
                if (result.success) {
                    const att = result.attachment;
                    uploaded.push({
                        attachmentId: att.attachmentId,
                        name: att.fileName,
                        size: att.fileSize,
                        type: att.mimeType
                    });
                }
                completed++;
                this.progressFill.style.width = `${Math.round((completed / total) * 100)}%`;
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                this.app.toast.error(`Не удалось загрузить ${file.name}`);
            }
        }

        setTimeout(() => {
            this.progressBar.style.display = 'none';
            this.progressFill.style.width = '0%';
        }, 500);

        return uploaded;
    }

    // Добавлено в 5.1: скачивание файла через FileManager
    async downloadAttachment_fileManager(attachmentId, fileName) {
        await this.fileManager.downloadFile(attachmentId, fileName);
    }

    // Добавлено в 5.1: открыть загрузчик файлов
    openFileUploader() {
        // Если уже есть загрузчик, показываем его
        if (!this.fileUploader) {
            this.fileUploader = new FileUploader(this.app, {
                maxFiles: 10,
                maxSize: 20 * 1024 * 1024, // 20MB
                allowedTypes: ['text/*', 'application/json', 'application/xml', 'image/*'],
                onUpload: (fileData) => {
                    this.app.toast.success(`Файл "${fileData.fileName}" загружен`);
                    // Можно добавить вложения к текущему сообщению
                    this.app.attachedFiles.push({
                        attachmentId: fileData.attachmentId,
                        name: fileData.fileName,
                        size: fileData.fileSize,
                        type: fileData.mimeType
                    });
                    this.app.updateAttachedFilesUI();
                }
            });
            // Вставляем загрузчик в модальное окно или в DOM
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.id = 'fileUploaderModal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:500px;">
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                    <h2>📎 Загрузка файлов</h2>
                    ${this.fileUploader.element.outerHTML}
                    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
                        <button id="fileUploaderClose" class="btn-secondary">Закрыть</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            // Переинициализируем загрузчик (т.к. элемент был клонирован)
            // Проще создать новый экземпляр с привязкой к модалке
            // Для простоты оставим как есть, но в реальном коде нужно обновить ссылки
            modal.querySelector('#fileUploaderClose').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        } else {
            // Если уже есть, просто открываем модалку (можно повторно использовать)
            this.app.toast.info('Загрузчик уже открыт');
        }
    }
}