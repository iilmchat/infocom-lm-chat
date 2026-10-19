// src/ui/views/private-chat.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Модальное окно приватного чата
 * Изменено в 5.1: добавлено создание чата с пользователем
 * Изменено в 6.1: кнопки получили классы btn, btn-primary, btn-secondary
 */
export class PrivateChat {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('privateChatModal'));
        this.currentChatId = null;
        this.currentUser = null;
        this.messages = [];
        this.isOpen = false;
        this.pollingInterval = null;
        this.setupEventListeners();
    }

    /**
     * Открыть приватный чат с пользователем
     * {Object} user - Пользователь для чата
     * Изменено в 5.1: если user не передан, показываем выбор
     */
    open(user = null) {
        if (user) {
            this.currentUser = user;
            this.currentChatId = null;
            this.messages = [];

            // Ищем существующий чат
            const chat = this.app.multiUserManager.privateChats.find(c =>
                (c.user1Id === this.app.multiUserManager.localUser.Id && c.user2Id === user.Id) ||
                (c.user1Id === user.Id && c.user2Id === this.app.multiUserManager.localUser.Id)
            );
            if (chat) {
                this.currentChatId = chat.id;
                this.loadHistory();
                this.modal.open();
                this.isOpen = true;
                // Обновляем заголовок                
                this.updateTitle();
                return;
            }
            // Иначе создаём
            this.createWithUser(user.Id);     
        } else {
            // Показываем выбор пользователя
            this.showUserSelector();                   
        }            
    }

    /**
     * Закрыть приватный чат
     */    
    close() {
        this.modal.close();
        this.isOpen = false;
        this.stopPolling();
        this.currentChatId = null;
        this.currentUser = null;
        this.messages = [];
        document.getElementById('privateMessages').innerHTML = '';
    }

    /**
     * Обновить заголовок чата
     */
    updateTitle() {
        if (this.currentUser) {
            document.getElementById('privateChatTitle').textContent = 
                `${this.currentUser.Avatar} ${sanitizeHTML(this.currentUser.Name)}`;
        }
    }

    /**
     * Создать чат с пользователем
     * Добавлено в 5.1.
     */
    async createWithUser(userId) {
        try {
            const result = await this.app.multiUserManager.api.createPrivateChat({
                user1Id: this.app.multiUserManager.localUser.Id,
                //user2Id: user.id
                user2Id: userId
            });

            if (result.success) {
                this.currentChatId = result.chatId;
                // Находим пользователя
                const user = this.app.multiUserManager.peers.get(userId) || { id: userId, name: userId, avatar: '👤',Id: userId, Name: userId, Avatar: '👤' };
                this.currentUser = user;
                this.updateTitle();
                await this.loadHistory();
                this.startPolling();
                this.modal.open();
                this.isOpen = true;
                return true;
            }
        } catch (error) {
            console.error('Ошибка создания чата:', error);            
            this.app.toast.error('Не удалось создать чат');
        }
        return false;
    }
    
    /**
     * Показать диалог выбора пользователя
     * Добавлено в 5.1.
     */
    showUserSelector() {
        const users = this.app.multiUserManager.getAvailableUsers();
        if (!users.length) {
            this.app.toast.warning('Нет доступных пользователей');
            return;
        }
        // Создаём модальное окно выбора
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
            el.addEventListener('click', () => {
                const userId = el.dataset.userId;
                modal.remove();
                this.createWithUser(userId);
            });
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
        
    /**
     * Загрузить историю сообщений
     * Изменено в 5.1: добавлена отметка прочитанных
     */
    async loadHistory() {
        if (!this.currentChatId) return;
        try {
            const result = await this.app.multiUserManager.api.getPrivateHistory(
                this.currentChatId,
                50,
                0
            );

            if (result.success) {
                this.messages = result.messages || [];
                this.renderMessages();
                this.scrollToBottom();
                
                // Отмечаем как прочитанные
                await this.app.multiUserManager.api.markPrivateRead({
                    chatId: this.currentChatId,
                    userId: this.app.multiUserManager.localUser.Id
                });
                // Обновляем бейдж
                this.app.multiUserManager.getUnreadCount();                
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            this.app.toast.error('Ошибка загрузки истории');
        }
    }

    /**
     * Отобразить сообщения
     */
    renderMessages() {
        const container = document.getElementById('privateMessages');
        const currentUserId = this.app.multiUserManager.localUser.Id;

        if (!this.messages.length) {
            container.innerHTML = `
                <div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:14px;">
                    💬 Нет сообщений. Начните диалог!
                </div>
            `;
            return;
        }

        container.innerHTML = this.messages.map(msg => {
            const isOwn = msg.SenderId === currentUserId;
            return `
                <div class="private-message ${isOwn ? 'own' : 'other'}">
                    <div class="private-message-avatar">${isOwn ? '👤' : (msg.SenderAvatar || '👤')}</div>
                    <div class="private-message-content">
                        <div class="private-message-header">
                            <span class="private-message-name">${isOwn ? 'Вы' : sanitizeHTML(msg.SenderName)}</span>
                            <span class="private-message-time">${new Date(msg.Timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="private-message-text">${sanitizeHTML(msg.Content)}</div>
                        ${msg.IsRead ? '<span class="private-message-read">✅ Прочитано</span>' : ''}
                        ${msg.IsEdited ? '<span class="private-message-edited">✏️</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Отправить сообщение
     */
    async sendMessage() {
        const input = document.getElementById('privateMessageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentChatId || !this.currentUser) return;

        try {
            const result = await this.app.multiUserManager.api.sendPrivateMessage({
                chatId: this.currentChatId,
                senderId: this.app.multiUserManager.localUser.Id,
                receiverId: this.currentUser.Id,
                content: content
            });

            if (result.success) {
                this.messages.push(result.message);
                this.renderMessages();
                this.scrollToBottom();
                input.value = '';
                this.app.toast.success('💬 Сообщение отправлено');
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.app.toast.error('❌ Ошибка отправки');
        }
    }

    /**
     * Запустить опрос новых сообщений
     */
    startPolling() {
        // Останавливаем предыдущий polling
        this.stopPolling();

        this.pollingInterval = setInterval(async () => {
            if (!this.isOpen || !this.currentChatId) return;
            await this.loadHistory();
        }, 5000);
    }

    /**
     * Остановить опрос
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Прокрутить вниз
     */
    scrollToBottom() {
        const container = document.getElementById('privateMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Отправка по Enter
        const input = document.getElementById('privateMessageInput');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Кнопка отправки – добавляем классы btn btn-primary
        const sendBtn = document.getElementById('privateSendBtn');
        if (sendBtn) {
            sendBtn.classList.add('btn', 'btn-primary');
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Закрытие
        const closeBtn = document.getElementById('privateChatClose');
        if (closeBtn) {
            closeBtn.classList.add('btn', 'btn-secondary');
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }

        // Закрытие по клику на overlay
        const modal = document.getElementById('privateChatModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // Кнопка создания нового приватного чата в sidebar
        const newChatBtn = document.getElementById('newPrivateChatBtn');
        if (newChatBtn) {
            newChatBtn.classList.add('btn', 'btn-secondary', 'btn-sm');
            newChatBtn.addEventListener('click', () => {
                this.showUserSelector();
            });
        }     
    }
}