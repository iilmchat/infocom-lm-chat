// src/modules/private/PrivateChatModule.js
/**
 * Модуль приватных чатов
 * Добавлено в 6.0
 * 
 * Изменено в 6.1:
 * - Добавлены упоминания (@) с выпадающим списком пользователей
 * - Интеграция с уведомлениями при получении новых сообщений
 * - Поиск по сообщениям в текущем чате
 * - Бесконечная пагинация (подгрузка при скролле вверх)
 * - Доработаны стили и улучшен UX
 */

import { CONFIG } from '../../config.js';
import { sanitizeHTML, validateInput, validateLength } from '../../services/sanitizer.js';
import { MessageRenderer } from '../../ui/renderers/message-renderer.js';
import { copyToClipboard, addCopyButtonsToCodeBlocks } from '../../utils/dom-helpers.js';
import { FileManager } from '../../models/file-manager.js';
import { ReactionManager } from '../../models/reaction-manager.js';
import { markdownService } from '../../services/markdown-service.js';

export class PrivateChatModule {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.messageRenderer = new MessageRenderer();
        this.fileManager = new FileManager(app);
        this.reactionManager = new ReactionManager(app);

        // Состояние
        this.currentChatId = null;
        this.currentUser = null;
        this.messages = [];
        this.pinnedMessages = [];
        this.isLoading = false;
        this.hasMore = true;
        this.offset = 0;
        this.pageSize = 50;
        this.searchQuery = '';

        // DOM элементы (создаются в render)
        this.messagesEl = null;
        this.inputEl = null;
        this.sendBtn = null;
        this.chatListEl = null;
        this.titleEl = null;
        this.searchInput = null;

        // Таймер опроса
        this.pollInterval = null;

        this.render();
        this.setupEventListeners();
        this.loadChats();
    }

    /* ===================== РЕНДЕРИНГ ===================== */

    render() {
        this.container.innerHTML = `
            <div class="private-chat-layout" style="display:flex; height:100%;">
                <!-- Сайдбар со списком чатов -->
                <div class="private-chat-sidebar" style="width:280px; border-right:1px solid var(--border-color); display:flex; flex-direction:column; background:var(--bg-secondary);">
                    <div class="private-chat-header" style="padding:12px 16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <h3>💬 Приватные чаты</h3>
                        <button id="newPrivateChatBtnMain" class="btn btn-primary btn-sm">+ Новый</button>
                    </div>
                    <div id="privateChatList" class="private-chat-list" style="flex:1; overflow-y:auto; padding:8px;"></div>
                </div>

                <!-- Основная область чата -->
                <div class="private-chat-main" style="flex:1; display:flex; flex-direction:column; background:var(--bg-primary);">
                    <div class="private-chat-messages-header" style="padding:12px 16px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span id="privateChatTitleMain" style="font-weight:600; font-size:16px;">Выберите чат</span>
                        <div class="private-chat-actions" style="display:flex; gap:8px; align-items:center;">
                            <!-- Добавлено в 6.1: поле поиска -->
                            <input type="text" id="privateSearchInput" placeholder="🔍 Поиск по сообщениям..." style="padding:4px 12px; border-radius:20px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); width:200px;">
                            <button id="privateBackBtn" class="btn btn-secondary btn-sm" data-link="/">← Назад</button>
                        </div>
                    </div>

                    <!-- Контейнер сообщений -->
                    <div id="privateMessagesMain" class="private-messages-container" style="flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:8px;"></div>

                    <!-- Область ввода -->
                    <div class="private-chat-input-area" style="padding:12px 16px; border-top:1px solid var(--border-color); background:var(--bg-secondary);">
                        <div style="display:flex; gap:10px; align-items:flex-end;">
                            <textarea id="privateInput" placeholder="Введите сообщение... (Ctrl+Enter для отправки)" rows="2" style="flex:1; padding:8px 12px; border-radius:12px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary); resize:none; font-family:inherit;"></textarea>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <button id="privateFileBtn" class="btn btn-secondary btn-sm" title="Прикрепить файл">📎</button>
                                <button id="privateSendBtnMain" class="btn btn-primary">Отправить</button>
                        </div>
                    </div>
                        <div id="privateFileInfo" class="file-info" style="display:none; margin-top:4px;">
                        <span>📎 Прикреплённые:</span>
                        <div id="privateFileList" class="rag-files-list"></div>
                    </div>
                        <!-- Контейнер для подсказок упоминаний (добавлен в 6.1) -->
                        <div id="mentionSuggestions" class="mention-suggestions" style="display:none;"></div>
                    </div>
                </div>
            </div>
        `;

        // Ссылки на элементы
        this.messagesEl = document.getElementById('privateMessagesMain');
        this.inputEl = document.getElementById('privateInput');
        this.sendBtn = document.getElementById('privateSendBtnMain');
        this.chatListEl = document.getElementById('privateChatList');
        this.titleEl = document.getElementById('privateChatTitleMain');
        this.searchInput = document.getElementById('privateSearchInput');
        this.mentionContainer = document.getElementById('mentionSuggestions');
    }

    /* ===================== НАСТРОЙКА ОБРАБОТЧИКОВ ===================== */

    setupEventListeners() {
        // Отправка по Ctrl+Enter
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Отправка по кнопке
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Кнопка "Назад" (роутер)
        document.getElementById('privateBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });

        // Кнопка нового чата
        document.getElementById('newPrivateChatBtnMain')?.addEventListener('click', () => {
            this.showUserSelector();
        });

        // Кнопка прикрепления файлов
        document.getElementById('privateFileBtn')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = CONFIG.SECURITY.ALLOWED_EXTENSIONS.join(',');
            input.onchange = (e) => this.handleFileUpload(e.target.files);
            input.click();
        });

        /* Добавлено в 6.1: поиск по сообщениям */
        this.searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.filterMessages(this.searchQuery);
        });

        /* Добавлено в 6.1: обработка упоминаний */
        this.inputEl.addEventListener('input', (e) => {
            this.handleMentionInput(e);
        });

        // Делегирование для списка чатов
        this.chatListEl.addEventListener('click', (e) => {
            const item = e.target.closest('.private-chat-item');
            if (item) {
                const chatId = item.dataset.chatId;
                const userId = item.dataset.userId;
                this.openChat(chatId, userId);
            }
        });

        // Делегирование для сообщений (реакции, закрепление, жалобы)
        this.messagesEl.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const messageEl = target.closest('.message');
            if (!messageEl) return;
            const messageId = messageEl.dataset.messageId;

            // Реакции (если реализованы)
            if (target.classList.contains('reaction-btn')) {
                const emoji = target.dataset.emoji;
                this.toggleReaction(messageId, emoji);
                return;
            }

            // Закрепить
            if (target.classList.contains('pin-btn')) {
                this.pinMessage(messageId);
                return;
            }

            // Пожаловаться
            if (target.classList.contains('report-btn')) {
                this.reportMessage(messageId);
                return;
            }

            // Ответить
            if (target.classList.contains('reply-btn')) {
                const content = messageEl.querySelector('.bubble')?.textContent || '';
                this.setReplyTarget(messageId, content);
                return;
            }

            // Редактировать (только свои)
            if (target.classList.contains('edit-btn')) {
                const content = messageEl.querySelector('.bubble')?.textContent || '';
                this.startEditing(messageId, content);
                return;
            }
        });

        /* Добавлено в 6.1: бесконечная пагинация (скролл вверх) */
        this.messagesEl.addEventListener('scroll', () => {
            if (this.messagesEl.scrollTop === 0 && !this.isLoading && this.hasMore) {
                this.loadHistory(true);
            }
        });

        // Закрытие подсказок упоминаний при клике вне
        document.addEventListener('click', (e) => {
            if (!this.inputEl.contains(e.target) && !this.mentionContainer.contains(e.target)) {
                this.hideMentionSuggestions();
            }
        });        
    }

    /* ===================== УПОМИНАНИЯ (добавлено в 6.1) ===================== */

    handleMentionInput(e) {
        const text = this.inputEl.value;
        const cursorPos = this.inputEl.selectionStart;
        const before = text.substring(0, cursorPos);
        const match = before.match(/@(\w*)$/);
        if (match) {
            const query = match[1];
            this.showMentionSuggestions(query);
        } else {
            this.hideMentionSuggestions();
        }
    }

    showMentionSuggestions(query) {
        const users = this.app.multiUserManager.getAvailableUsers();
        const filtered = users.filter(u =>
            u.Name.toLowerCase().includes(query.toLowerCase()) &&
            u.Id !== this.app.multiUserManager.localUser.Id
        );
        if (filtered.length === 0) {
            this.mentionContainer.style.display = 'none';
            return;
        }
        this.mentionContainer.innerHTML = filtered.map(u => `
            <div class="mention-item" data-user-id="${u.Id}" style="padding:6px 12px; cursor:pointer; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border-color);">
                <span>${u.Avatar}</span>
                <span>${sanitizeHTML(u.Name)}</span>
            </div>
        `).join('');
        this.mentionContainer.style.display = 'block';
        // Обработчики для выбора пользователя
        this.mentionContainer.querySelectorAll('.mention-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const user = this.app.multiUserManager.peers.get(userId);
                if (user) {
                    const text = this.inputEl.value;
                    const cursorPos = this.inputEl.selectionStart;
                    const before = text.substring(0, cursorPos);
                    const after = text.substring(cursorPos);
                    const beforeMatch = before.match(/@\w*$/);
                    if (beforeMatch) {
                        const newText = text.substring(0, cursorPos - beforeMatch[0].length) + `@${user.Name} ` + after;
                        this.inputEl.value = newText;
                        this.inputEl.focus();
                        const newPos = cursorPos - beforeMatch[0].length + user.Name.length + 2;
                        this.inputEl.selectionStart = this.inputEl.selectionEnd = newPos;
                    }
                    this.hideMentionSuggestions();
                }
            });
        });
        // Позиционирование
        const rect = this.inputEl.getBoundingClientRect();
        this.mentionContainer.style.bottom = (rect.height + 4) + 'px';
        this.mentionContainer.style.left = '0';
        this.mentionContainer.style.width = '100%';
    }

    hideMentionSuggestions() {
        this.mentionContainer.style.display = 'none';
    }

    /* ===================== ЗАГРУЗКА СПИСКА ЧАТОВ ===================== */
    
    async loadChats() {
        try {
            const chats = await this.app.multiUserManager.loadPrivateChats();
            this.renderChats(chats);
        } catch (error) {
            console.error('Ошибка загрузки чатов:', error);
            this.app.toast.error('Не удалось загрузить чаты');
        }
    }

    renderChats(chats) {
        if (!chats || chats.length === 0) {
            this.chatListEl.innerHTML = `
                <div style="padding:16px;text-align:center;color:var(--text-secondary);">
                    Нет приватных чатов.<br>
                    Нажмите «+ Новый», чтобы начать.
                </div>
            `;
            return;
        }

        this.chatListEl.innerHTML = chats.map(chat => {
            const otherUserId = chat.User1Id === this.app.multiUserManager.localUser.Id
                ? chat.User2Id
                : chat.User1Id;
            const peer = this.app.multiUserManager.peers.get(otherUserId);
            const name = peer?.Name || otherUserId;
            const avatar = peer?.Avatar || '👤';
            const color = peer?.Color || '#888';
            const lastMsg = chat.LastMessage || 'Нет сообщений';
            const unread = chat.unreadCount || 0;

            return `
                <div class="private-chat-item" data-chat-id="${chat.ChatId}" data-user-id="${otherUserId}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; cursor:pointer; transition:background 0.2s; border-bottom:1px solid var(--border-color);">
                    <div class="private-chat-avatar" style="font-size:28px; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${avatar}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px;">${sanitizeHTML(name)}</div>
                        <div style="font-size:11px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizeHTML(lastMsg.substring(0, 50))}</div>
                    </div>
                    ${unread > 0 ? `<span class="unread-badge" style="background:var(--error-color); color:#fff; border-radius:50%; padding:1px 6px; font-size:10px; font-weight:600; min-width:18px; text-align:center;">${unread}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    /* ===================== ОТКРЫТИЕ ЧАТА ===================== */

    async openChat(chatId, userId) {
        if (this.currentChatId === chatId) return;

        this.currentChatId = chatId;
        this.currentUser = this.app.multiUserManager.peers.get(userId);
        if (!this.currentUser) {
            this.currentUser = { Id: userId, Name: userId, Avatar: '👤' };
        }

        this.titleEl.textContent = `${this.currentUser.Avatar} ${sanitizeHTML(this.currentUser.Name)}`;
        this.messages = [];
        this.offset = 0;
        this.hasMore = true;
        this.searchQuery = '';
        if (this.searchInput) this.searchInput.value = '';

        await this.loadHistory();
        this.startPolling();
    }

    /* ===================== ЗАГРУЗКА ИСТОРИИ ===================== */

    async loadHistory(append = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const result = await this.app.multiUserManager.api.getPrivateHistory(
                this.currentChatId,
                this.pageSize,
                append ? this.offset : 0
            );

            if (result.success) {
                const messages = result.messages || [];
                this.hasMore = result.hasMore || false;

                if (!append) {
                    this.messages = messages;
                    this.offset = messages.length;
                    this.renderMessages();
                } else {
                    // Добавляем старые сообщения в начало
                    this.messages = [...messages, ...this.messages];
                    this.offset += messages.length;
                    this.renderMessages(true);
                }

                // Отмечаем прочитанные
                await this.app.multiUserManager.api.markPrivateRead({
                    chatId: this.currentChatId,
                    userId: this.app.multiUserManager.localUser.Id
                });
                this.app.multiUserManager.getUnreadCount();

                /* Добавлено в 6.1: отправка уведомлений о новых сообщениях */
                if (!append) {
                    // Проверяем последние сообщения от других пользователей
                    const newMessages = messages.filter(m => m.SenderId !== this.app.multiUserManager.localUser.Id);
                    for (const msg of newMessages) {
                        this.app.notificationManager.addNotification?.({
                            type: 'private_message',
                            title: `💬 Приватное сообщение от ${msg.SenderName}`,
                            body: msg.content,
                            data: { chatId: this.currentChatId, userId: msg.SenderId }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.app.toast.error('Не удалось загрузить историю');
        } finally {
            this.isLoading = false;
        }
    }

    /* ===================== ОТОБРАЖЕНИЕ СООБЩЕНИЙ ===================== */

    renderMessages(append = false) {
        // Применяем поисковый фильтр (если есть)
        const filtered = this.searchQuery
            ? this.messages.filter(msg => msg.content.toLowerCase().includes(this.searchQuery))
            : this.messages;

        if (!filtered.length) {
            this.messagesEl.innerHTML = `
                <div style="padding:20px;text-align:center;color:var(--text-secondary);">
                    ${this.searchQuery ? '🔍 Сообщения не найдены' : '💬 Нет сообщений. Начните диалог!'}
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        filtered.forEach(msg => {
            const el = this.messageRenderer.render({
                role: msg.SenderId === this.app.multiUserManager.localUser.Id ? 'user' : 'bot',
                content: msg.Content,
                messageId: msg.MessageId || msg.Id || msg.id,
                files: msg.Attachments,
                isEdit: msg.IsEdited,
                replyTo: msg.ReplyToId ? { content: msg.ReplyToId.Content, role: msg.ReplyToId.Role } : null
            }, markdownService);

            // Добавляем кнопки реакций и действий
            this.addReactionButtons(el,  msg.MessageId || msg.Id || msg.id);
            this.addActionButtons(el,  msg.MessageId || msg.Id || msg.id, msg.SenderId);

            fragment.appendChild(el);
        });

        if (append) {
            // Добавляем в начало (сохраняем позицию скролла)
            const scrollHeight = this.messagesEl.scrollHeight;
            this.messagesEl.prepend(fragment);
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight - scrollHeight;
        } else {
            this.messagesEl.innerHTML = '';
            this.messagesEl.appendChild(fragment);
            this.scrollToBottom();
        }
    }

    /* Добавлено в 6.1: фильтрация сообщений при поиске */
    filterMessages(query) {
        this.searchQuery = query;
        this.renderMessages(false);
    }

    /* ===================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===================== */

    addReactionButtons(el, messageId) {
        const container = el.querySelector('.reactions-container') || document.createElement('div');
        container.className = 'reactions-container';
        container.dataset.messageId = messageId;

        const emojiBar = document.createElement('div');
        emojiBar.className = 'reactions-emoji-bar';
        const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        emojis.forEach(emoji => {
            const btn = document.createElement('button');
            btn.textContent = emoji;
            btn.className = 'reaction-btn btn btn-secondary btn-sm';
            btn.dataset.emoji = emoji;
            btn.title = `Реакция ${emoji}`;
            emojiBar.appendChild(btn);
        });
        container.appendChild(emojiBar);

        const list = document.createElement('div');
        list.className = 'reactions-list';
        list.id = `private-reactions-${messageId}`;
        container.appendChild(list);

        // Добавляем в конец сообщения
        el.appendChild(container);
    }

    addActionButtons(el, messageId, senderId) {
        const actions = document.createElement('div');
        actions.className = 'private-message-actions';
        actions.style.cssText = 'display:flex; gap:4px; margin-top:4px;';

        const isOwn = senderId === this.app.multiUserManager.localUser.Id;
        const isModerator = this.app.multiUserManager.isModeratorUser();

        // Закрепить (для модераторов или владельца)
        if (isModerator || isOwn) {
            const pinBtn = document.createElement('button');
            pinBtn.textContent = '📌';
            pinBtn.className = 'pin-btn btn btn-secondary btn-sm';
            pinBtn.title = 'Закрепить';
            actions.appendChild(pinBtn);
        }

        // Пожаловаться (для всех)
        const reportBtn = document.createElement('button');
        reportBtn.textContent = '🚨';
        reportBtn.className = 'report-btn btn btn-secondary btn-sm';
        reportBtn.title = 'Пожаловаться';
        actions.appendChild(reportBtn);

        // Ответить (для всех)
        const replyBtn = document.createElement('button');
        replyBtn.textContent = '↩️';
        replyBtn.className = 'reply-btn btn btn-secondary btn-sm';
        replyBtn.title = 'Ответить';
        actions.appendChild(replyBtn);

        // Редактировать (только свои)
        if (isOwn) {
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.className = 'edit-btn btn btn-secondary btn-sm';
            editBtn.title = 'Редактировать';
            actions.appendChild(editBtn);
        }

        // Добавляем в конец label (в messageRenderer уже есть .label, но мы добавим отдельно)
        const label = el.querySelector('.label');
        if (label) {
            label.appendChild(actions);
        } else {
            el.appendChild(actions);
        }
    }

    /* ===================== ОТПРАВКА СООБЩЕНИЯ ===================== */

    async sendMessage() {
        let content = this.inputEl.value.trim();
        if (!content || !this.currentChatId) return;

        // Валидация
        const validation = validateInput(content);
        if (!validation.valid) {
            this.app.toast.error(validation.reason);
            return;
        }

        // Извлечение упоминаний (добавлено в 6.1)
        const mentionedUsers = this.extractMentions(content);

        try {
            const result = await this.app.multiUserManager.api.sendPrivateMessage({
                chatId: this.currentChatId,
                senderId: this.app.multiUserManager.localUser.Id,
                receiverId: this.currentUser.Id,
                content: content,
                replyToId: this.replyTarget?.messageId || null,
                mentions: mentionedUsers // добавляем упоминания в запрос
            });

            if (result.success) {
                this.messages.push(result.message);
                this.renderMessages();
                this.scrollToBottom();
                this.inputEl.value = '';
                this.clearReplyTarget();
                this.app.toast.success('💬 Сообщение отправлено');
                // Если есть упоминания – отправляем уведомления
                if (mentionedUsers.length > 0) {
                    this.sendMentionNotifications(mentionedUsers, content);
                }
                this.loadChats();
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.app.toast.error('Не удалось отправить сообщение');
        }
    }

    /* Добавлено в 6.1: извлечение упоминаний из текста */
    extractMentions(text) {
        const mentions = [];
        const regex = /@(\w+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const username = match[1];
            const user = this.app.multiUserManager.peers.find(p => p.Name.toLowerCase() === username.toLowerCase());
            if (user) {
                mentions.push(user.Id);
            } else if (this.app.multiUserManager.localUser.Name.toLowerCase() === username.toLowerCase()) {
                mentions.push(this.app.multiUserManager.localUser.Id);
            }
        }
        return mentions;
    }

    /* Добавлено в 6.1: отправка уведомлений упомянутым пользователям */
    sendMentionNotifications(userIds, content) {
        for (const userId of userIds) {
            const user = this.app.multiUserManager.peers.get(userId);
            if (user && userId !== this.app.multiUserManager.localUser.Id) {
                this.app.notificationManager.addNotification?.({
                    type: 'mention',
                    title: `@${user.Name} упомянул вас в приватном чате`,
                    body: content.substring(0, 100),
                    data: { chatId: this.currentChatId, userId: userId }
                });
            }
        }
    }

    /* ===================== РЕАКЦИИ, ЗАКРЕПЛЕНИЕ, ЖАЛОБЫ ===================== */

    async toggleReaction(messageId, emoji) {
        const current = this.reactionManager.getReactions(messageId);
        if (current.userReaction === emoji) {
            await this.reactionManager.removeReaction(messageId);
        } else {
            await this.reactionManager.addReaction(messageId, emoji);
        }
        this.updateReactionsUI(messageId);
    }

    async updateReactionsUI(messageId) {
        const reactions = this.reactionManager.getReactions(messageId);
        const list = document.getElementById(`private-reactions-${messageId}`);
        if (!list) return;
        const userReaction = reactions.userReaction;
        list.innerHTML = Object.entries(reactions.reactions).map(([emoji, count]) => `
            <span class="reaction-item ${userReaction === emoji ? 'user-reacted' : ''}" data-emoji="${emoji}">
                ${emoji} ${count}
            </span>
        `).join('');
    }

    // ===== ЗАКРЕПЛЕНИЕ =====
    async pinMessage(messageId) {
        try {
            const result = await this.app.apiService.pinMessage(messageId, {
                roomId: this.currentChatId,
                userId: this.app.multiUserManager.localUser.Id
            });
            if (result.success) {
                this.app.toast.success('Сообщение закреплено');
                this.loadPinnedMessages();
            }
        } catch (error) {
            console.error('Ошибка закрепления:', error);
            this.app.toast.error('Не удалось закрепить');
        }
    }

    async loadPinnedMessages() {
        try {
            const result = await this.app.apiService.getPinnedMessages(this.currentChatId);
            if (result.success) {
                this.pinnedMessages = result.messages || [];
                this.renderPinnedMessages();
            }
        } catch (error) {
            console.warn('Ошибка загрузки закреплённых:', error);
        }
    }

    renderPinnedMessages() {
        // Отображаем закреплённые сверху
        let container = this.messagesEl.querySelector('.pinned-messages');
        if (!container) {
            container = document.createElement('div');
            container.className = 'pinned-messages';
            this.messagesEl.prepend(container);
        }
        if (!this.pinnedMessages.length) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        container.innerHTML = `
            <div class="pinned-header" style="font-weight:600; color:var(--gold-color); margin-bottom:4px;">📌 Закреплённые</div>
            ${this.pinnedMessages.map(msg => `
                <div class="pinned-item" style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:4px 0; border-bottom:1px solid var(--border-color);">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitizeHTML(msg.content.substring(0, 100))}</span>
                    <button class="unpin-btn btn btn-danger btn-sm" data-message-id="${msg.id}">✕</button>
                </div>
            `).join('')}
        `;
        container.querySelectorAll('.unpin-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const messageId = btn.dataset.messageId;
                await this.unpinMessage(messageId);
            });
        });
    }

    async unpinMessage(messageId) {
        try {
            await this.app.apiService.unpinMessage(messageId, this.currentChatId);
            this.pinnedMessages = this.pinnedMessages.filter(m => m.id !== messageId);
            this.renderPinnedMessages();
            this.app.toast.info('Откреплено');
        } catch (error) {
            console.error('Ошибка открепления:', error);
        }
    }

    // ===== ЖАЛОБА =====
    async reportMessage(messageId) {
        const reason = prompt('Причина жалобы:');
        if (!reason) return;
        try {
            const result = await this.app.apiService.reportMessage(messageId, {
                reporterId: this.app.multiUserManager.localUser.Id,
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

    /* ===================== РЕДАКТИРОВАНИЕ ===================== */

    startEditing(messageId, content) {
        // Простая реализация: заменяем текст в баббле на input
        const el = this.messagesEl.querySelector(`[data-message-id="${messageId}"]`);
        if (!el) return;
        const bubble = el.querySelector('.bubble');
        if (!bubble) return;

        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.rows = 3;
        textarea.style.cssText = 'width:100%; padding:8px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-primary);';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.className = 'btn btn-primary';
        saveBtn.style.marginTop = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✕ Отмена';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.style.marginLeft = '8px';

        const controls = document.createElement('div');
        controls.appendChild(textarea);
        controls.appendChild(saveBtn);
        controls.appendChild(cancelBtn);

        bubble.innerHTML = '';
        bubble.appendChild(controls);

        const save = async () => {
            const newContent = textarea.value.trim();
            if (!newContent) {
                this.app.toast.warning('Сообщение не может быть пустым');
                return;
            }
            try {
                const result = await this.app.apiService.editPrivateMessage(messageId, {
                    userId: this.app.multiUserManager.localUser.Id,
                    newContent: newContent
                });
                if (result.success) {
                    this.app.toast.success('Сообщение обновлено');
                    // Перезагружаем историю
                    await this.loadHistory();
                }
            } catch (error) {
                console.error('Ошибка редактирования:', error);
                this.app.toast.error('Не удалось отредактировать');
            }
        };

        saveBtn.onclick = save;
        cancelBtn.onclick = () => this.loadHistory(); // перезагрузка отменяет редактирование
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
            }
            if (e.key === 'Escape') {
                this.loadHistory();
            }
        });
        textarea.focus();
    }

    /* ===================== ОТВЕТ НА СООБЩЕНИЕ ===================== */

    setReplyTarget(messageId, content) {
        this.replyTarget = { messageId, content };
        this.inputEl.placeholder = `↩️ Ответ: ${content.substring(0, 60)}...`;
        this.inputEl.focus();
    }

    clearReplyTarget() {
        this.replyTarget = null;
        this.inputEl.placeholder = 'Введите сообщение... (Ctrl+Enter для отправки)';
    }

    /* ===================== ФАЙЛЫ ===================== */

    async handleFileUpload(files) {
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
        if (!validFiles.length) return;

        // Загружаем на сервер
        const uploaded = [];
        for (const f of validFiles) {
            try {
                const formData = new FormData();
                const blob = new Blob([f.content], { type: f.type || 'text/plain' });
                const fileObj = new File([blob], f.name, { type: f.type || 'text/plain' });
                formData.append('file', fileObj);
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
                this.app.toast.error(`Не удалось загрузить ${f.name}`);
            }
        }

        if (uploaded.length) {
            // Можно добавить вложения к текущему сообщению (сейчас просто сохраняем в состоянии)
            // В реальном коде нужно отправить вложение вместе с сообщением
            // Пока просто показываем список в UI
            const fileInfo = document.getElementById('privateFileInfo');
            const fileList = document.getElementById('privateFileList');
            if (fileInfo && fileList) {
                fileInfo.style.display = 'flex';
                fileList.innerHTML = uploaded.map(f =>
                    `<span class="file-tag" style="display:flex; align-items:center; gap:4px; padding:4px 10px; background:var(--bg-input); border-radius:12px; border:1px solid var(--border-color);">
                        📎 ${f.name}
                        <button class="remove-file btn btn-danger btn-sm" data-id="${f.attachmentId}">✕</button>
                    </span>`
                ).join('');
                fileList.querySelectorAll('.remove-file').forEach(btn => {
                    btn.onclick = () => {
                        // Удаляем из списка (пока без удаления с сервера)
                        btn.closest('.file-tag').remove();
                        if (!fileList.children.length) fileInfo.style.display = 'none';
                    };
                });
            }
            this.app.toast.success(`Загружено ${uploaded.length} файлов`);
        }
    }

    /* ===================== ПОЛЬЗОВАТЕЛЬСКИЙ ВЫБОР ===================== */

    showUserSelector() {
        const users = this.app.multiUserManager.getAvailableUsers();
        if (!users.length) {
            this.app.toast.warning('Нет доступных пользователей');
            return;
        }

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
                                <div style="font-weight:600;">${sanitizeHTML(u.Name)}</div>
                                <div style="font-size:11px;color:var(--text-secondary);">${u.IsTyping ? 'печатает...' : 'онлайн'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.user-select-item').forEach(el => {
            el.addEventListener('click', async () => {
                const userId = el.dataset.userId;
                modal.remove();
                const chatId = await this.app.multiUserManager.openPrivateChat({ Id: userId });
                if (chatId) {
                    this.loadChats();
                    this.openChat(chatId, userId);
                }
            });
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    /* ===================== ПОЛЛИНГ ===================== */

    startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.currentChatId) {
                this.loadHistory();
            }
        }, 5000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }


    /**
     * Извлечение упоминаний из текста
     * Добавлено в 5.1.
     */
    // Изменено в 6.0: удалены реакции, закрепления, жалобы, упоминания, загрузка файлов на сервер.
    // Эти функции перенесены в PrivateChatModule.    

    //Опять удалим 6.1
    /*         
    extractMentions(text) {
        
        const mentions = [];
        
        const regex = /@(\w+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const username = match[1];
            // Ищем пользователя среди peers и localUser
            const user = this.app.multiUserManager.peers.find(p => p.Name.toLowerCase() === username.toLowerCase());
            if (user) {
                mentions.push(user.Id);
            } else if (this.app.multiUserManager.localUser.Name.toLowerCase() === username.toLowerCase()) {
                mentions.push(this.app.multiUserManager.localUser.Id);
            }
        }
            
        return mentions;
    }
        
    */
    /* ===================== ВСПОМОГАТЕЛЬНЫЕ ===================== */

    scrollToBottom() {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    // ===== УНИЧТОЖЕНИЕ =====
    destroy() {
        this.stopPolling();
    }
}