// src/app.js

class App {
    constructor() {
        // ... существующая инициализация ...

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
}