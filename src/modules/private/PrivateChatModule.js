// src/modules/private/PrivateChatModule.js
/**
 * Модуль приватных чатов
 * Добавлено в 6.0
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

        // DOM элементы (создаются в render)
        this.messagesEl = null;
        this.inputEl = null;
        this.sendBtn = null;
        this.chatListEl = null;
        this.titleEl = null;

        // Таймер опроса
        this.pollInterval = null;

        this.render();
        this.setupEventListeners();
        this.loadChats();
    }

    render() {
        this.container.innerHTML = `
            <div class="private-chat-layout">
                <div class="private-chat-sidebar">
                    <div class="private-chat-header">
                        <h3>💬 Приватные чаты</h3>
                        <button id="newPrivateChatBtn" class="btn-primary">+ Новый</button>
                    </div>
                    <div id="privateChatList" class="private-chat-list"></div>
                </div>
                <div class="private-chat-main">
                    <div class="private-chat-messages-header">
                        <span id="privateChatTitle">Выберите чат</span>
                        <div class="private-chat-actions">
                            <button id="privateBackBtn" class="btn-secondary" data-link="/">← Назад</button>
                        </div>
                    </div>
                    <div id="privateMessages" class="private-messages-container"></div>
                    <div class="private-chat-input-area">
                        <textarea id="privateInput" placeholder="Введите сообщение..." rows="2"></textarea>
                        <div class="private-input-actions">
                            <button id="privateFileBtn" class="action-btn" title="Прикрепить файл">📎</button>
                            <button id="privateSendBtn" class="send-btn">Отправить</button>
                        </div>
                    </div>
                    <div id="privateFileInfo" class="file-info" style="display:none;">
                        <span>📎 Прикреплённые:</span>
                        <div id="privateFileList" class="rag-files-list"></div>
                    </div>
                </div>
            </div>
        `;

        // Ссылки на элементы
        this.messagesEl = document.getElementById('privateMessages');
        this.inputEl = document.getElementById('privateInput');
        this.sendBtn = document.getElementById('privateSendBtn');
        this.chatListEl = document.getElementById('privateChatList');
        this.titleEl = document.getElementById('privateChatTitle');
    }

    setupEventListeners() {
        // Отправка по Ctrl+Enter
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Кнопка "Назад" (роутер)
        document.getElementById('privateBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });

        // Кнопка нового чата
        document.getElementById('newPrivateChatBtn')?.addEventListener('click', () => {
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

            // Реакции
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
    }

    // ===== ЗАГРУЗКА СПИСКА ЧАТОВ =====
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
            const otherUserId = chat.user1Id === this.app.multiUserManager.localUser.Id
                ? chat.user2Id
                : chat.user1Id;
            const peer = this.app.multiUserManager.peers.get(otherUserId);
            const name = peer?.Name || otherUserId;
            const avatar = peer?.Avatar || '👤';
            const color = peer?.Color || '#888';
            const lastMsg = chat.lastMessage || 'Нет сообщений';
            const unread = chat.unreadCount || 0;

            return `
                <div class="private-chat-item" data-chat-id="${chat.id}" data-user-id="${otherUserId}">
                    <div class="private-chat-avatar" style="color:${color};">${avatar}</div>
                    <div class="private-chat-info">
                        <div class="private-chat-name">${sanitizeHTML(name)}</div>
                        <div class="private-chat-last">${sanitizeHTML(lastMsg.substring(0, 50))}</div>
                    </div>
                    ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    // ===== ОТКРЫТИЕ ЧАТА =====
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

        await this.loadHistory();
        this.startPolling();
    }

    // ===== ЗАГРУЗКА ИСТОРИИ =====
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
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.app.toast.error('Не удалось загрузить историю');
        } finally {
            this.isLoading = false;
        }
    }

    // ===== ОТОБРАЖЕНИЕ СООБЩЕНИЙ =====
    renderMessages(append = false) {
        if (!this.messages.length) {
            this.messagesEl.innerHTML = `
                <div style="padding:20px;text-align:center;color:var(--text-secondary);">
                    💬 Нет сообщений. Начните диалог!
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        this.messages.forEach(msg => {
            const el = this.messageRenderer.render({
                role: msg.senderId === this.app.multiUserManager.localUser.Id ? 'user' : 'bot',
                content: msg.content,
                messageId: msg.messageId || msg.id,
                files: msg.attachments,
                isEdit: msg.isEdited,
                replyTo: msg.replyTo ? { content: msg.replyTo.content, role: msg.replyTo.role } : null
            }, markdownService);

            // Добавляем кнопки реакций (уже есть в messageRenderer, но мы добавим свои)
            this.addReactionButtons(el, msg.messageId || msg.id);
            this.addActionButtons(el, msg.messageId || msg.id, msg.senderId);

            fragment.appendChild(el);
        });

        if (append) {
            // Добавляем в начало
            this.messagesEl.prepend(fragment);
        } else {
            this.messagesEl.innerHTML = '';
            this.messagesEl.appendChild(fragment);
            this.scrollToBottom();
        }
    }

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
            btn.className = 'reaction-btn';
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

        const isOwn = senderId === this.app.multiUserManager.localUser.Id;
        const isModerator = this.app.multiUserManager.isModeratorUser();

        // Закрепить (для модераторов или владельца)
        if (isModerator || isOwn) {
            const pinBtn = document.createElement('button');
            pinBtn.textContent = '📌';
            pinBtn.className = 'pin-btn';
            pinBtn.title = 'Закрепить';
            actions.appendChild(pinBtn);
        }

        // Пожаловаться (для всех)
        const reportBtn = document.createElement('button');
        reportBtn.textContent = '🚨';
        reportBtn.className = 'report-btn';
        reportBtn.title = 'Пожаловаться';
        actions.appendChild(reportBtn);

        // Ответить (для всех)
        const replyBtn = document.createElement('button');
        replyBtn.textContent = '↩️';
        replyBtn.className = 'reply-btn';
        replyBtn.title = 'Ответить';
        actions.appendChild(replyBtn);

        // Редактировать (только свои)
        if (isOwn) {
            const editBtn = document.createElement('button');
            editBtn.textContent = '✏️';
            editBtn.className = 'edit-btn';
            editBtn.className = 'btn btn-secondary btn-sm'; // добавляем классы            
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

    // ===== ОТПРАВКА СООБЩЕНИЯ =====
    async sendMessage() {
        const content = this.inputEl.value.trim();
        if (!content || !this.currentChatId) return;

        // Валидация
        const validation = validateInput(content);
        if (!validation.valid) {
            this.app.toast.error(validation.reason);
            return;
        }

        try {
            const result = await this.app.multiUserManager.api.sendPrivateMessage({
                chatId: this.currentChatId,
                senderId: this.app.multiUserManager.localUser.Id,
                receiverId: this.currentUser.Id,
                content: content,
                replyToId: this.replyTarget?.messageId || null
            });

            if (result.success) {
                this.messages.push(result.message);
                this.renderMessages();
                this.scrollToBottom();
                this.inputEl.value = '';
                this.clearReplyTarget();
                this.app.toast.success('💬 Сообщение отправлено');
                // Обновляем список чатов (последнее сообщение)
                this.loadChats();
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.app.toast.error('Не удалось отправить сообщение');
        }
    }

    // ===== РЕАКЦИИ =====
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
            <div class="pinned-header">📌 Закреплённые</div>
            ${this.pinnedMessages.map(msg => `
                <div class="pinned-item">
                    <span>${sanitizeHTML(msg.content.substring(0, 100))}</span>
                    <button class="unpin-btn" data-message-id="${msg.id}">✕</button>
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

    // ===== РЕДАКТИРОВАНИЕ =====
    startEditing(messageId, content) {
        // Простая реализация: заменяем текст в баббле на input
        const el = this.messagesEl.querySelector(`[data-message-id="${messageId}"]`);
        if (!el) return;
        const bubble = el.querySelector('.bubble');
        if (!bubble) return;

        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.rows = 3;
        textarea.style.width = '100%';
        textarea.style.padding = '8px';
        textarea.style.borderRadius = '8px';
        textarea.style.border = '1px solid var(--border-color)';
        textarea.style.background = 'var(--bg-input)';
        textarea.style.color = 'var(--text-primary)';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить';
        saveBtn.className = 'btn-primary';
        saveBtn.style.marginTop = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '✕ Отмена';
        cancelBtn.className = 'btn-secondary';
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

    // ===== ОТВЕТ НА СООБЩЕНИЕ =====
    setReplyTarget(messageId, content) {
        this.replyTarget = { messageId, content };
        this.inputEl.placeholder = `↩️ Ответ: ${content.substring(0, 60)}...`;
        this.inputEl.focus();
    }

    clearReplyTarget() {
        this.replyTarget = null;
        this.inputEl.placeholder = 'Введите сообщение...';
    }

    // ===== ФАЙЛЫ =====
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
                    `<span class="file-tag">📎 ${f.name} <button class="remove-file" data-id="${f.attachmentId}">✕</button></span>`
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

    // ===== ПОЛЬЗОВАТЕЛЬСКИЙ ВЫБОР =====
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

    // ===== ПОЛЛИНГ =====
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

    // ===== Упонимания =====
    /**
     * Извлечение упоминаний из текста
     * Добавлено в 5.1.
     */
    // Изменено в 6.0: удалены реакции, закрепления, жалобы, упоминания, загрузка файлов на сервер.
    // Эти функции перенесены в PrivateChatModule.    
             
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
        
    // ===== ВСПОМОГАТЕЛЬНЫЕ =====
    scrollToBottom() {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    // ===== УНИЧТОЖЕНИЕ =====
    destroy() {
        this.stopPolling();
    }
}