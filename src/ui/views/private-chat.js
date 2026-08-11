// src/ui/views/private-chat.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

export class PrivateChat {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('privateChatModal'));
        this.currentChatId = null;
        this.currentUser = null;
        this.messages = [];
        this.isOpen = false;
        this.setupEventListeners();
    }

    open(user) {
        this.currentUser = user;
        this.currentChatId = null;
        this.messages = [];
        
        // Загружаем или создаем чат
        this.loadChat(user);
        this.modal.open();
        this.isOpen = true;
        
        // Обновляем заголовок
        document.getElementById('privateChatTitle').textContent = 
            `${user.avatar} ${user.name}`;
    }

    close() {
        this.modal.close();
        this.isOpen = false;
        this.currentChatId = null;
        this.currentUser = null;
        this.messages = [];
        document.getElementById('privateMessages').innerHTML = '';
    }

    async loadChat(user) {
        try {
            const result = await this.app.multiUserManager.api.createPrivateChat({
                user1Id: this.app.multiUserManager.localUser.id,
                user2Id: user.id
            });

            if (result.success) {
                this.currentChatId = result.chatId;
                await this.loadHistory();
                this.startPolling();
            }
        } catch (error) {
            this.app.toast.error('Ошибка загрузки чата');
        }
    }

    async loadHistory() {
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
                    userId: this.app.multiUserManager.localUser.id
                });
            }
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
        }
    }

    renderMessages() {
        const container = document.getElementById('privateMessages');
        const currentUserId = this.app.multiUserManager.localUser.id;

        container.innerHTML = this.messages.map(msg => {
            const isOwn = msg.senderId === currentUserId;
            return `
                <div class="private-message ${isOwn ? 'own' : 'other'}">
                    <div class="private-message-avatar">${isOwn ? '👤' : msg.senderAvatar || '👤'}</div>
                    <div class="private-message-content">
                        <div class="private-message-header">
                            <span class="private-message-name">${isOwn ? 'Вы' : sanitizeHTML(msg.senderName)}</span>
                            <span class="private-message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="private-message-text">${sanitizeHTML(msg.content)}</div>
                        ${msg.isRead ? '<span class="private-message-read">✅ Прочитано</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async sendMessage() {
        const input = document.getElementById('privateMessageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentChatId || !this.currentUser) return;

        try {
            const result = await this.app.multiUserManager.api.sendPrivateMessage({
                chatId: this.currentChatId,
                senderId: this.app.multiUserManager.localUser.id,
                receiverId: this.currentUser.id,
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
            this.app.toast.error('❌ Ошибка отправки');
        }
    }

    startPolling() {
        // Останавливаем предыдущий polling
        this.stopPolling();

        this.pollingInterval = setInterval(async () => {
            if (!this.isOpen || !this.currentChatId) return;
            await this.loadHistory();
        }, 5000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    scrollToBottom() {
        const container = document.getElementById('privateMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    setupEventListeners() {
        // Отправка по Enter
        document.getElementById('privateMessageInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Кнопка отправки
        document.getElementById('privateSendBtn')?.addEventListener('click', () => {
            this.sendMessage();
        });

        // Закрытие
        document.getElementById('privateChatClose')?.addEventListener('click', () => {
            this.close();
        });
    }
}