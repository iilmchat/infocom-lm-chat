// src/ui/views/sidebar.js

export class Sidebar {
    // ... существующий код ...

    render() {
        this.renderChatList();
        this.updateStats();
        this.renderPrivateChats(); // Добавить
        this.renderUnreadBadge(); // Добавить
        this.updateSectionStates();
    }

    /**
     * Рендеринг приватных чатов в sidebar
     */
    async renderPrivateChats() {
        const container = document.getElementById('privateChatsList');
        if (!container) return;

        const chats = await this.app.multiUserManager.loadPrivateChats();
        
        if (!chats || chats.length === 0) {
            container.innerHTML = `
                <div style="padding:8px 16px;font-size:11px;color:var(--text-secondary);">
                    Нет приватных чатов
                </div>
            `;
            return;
        }

        container.innerHTML = chats.map(chat => {
            const otherUser = chat.user1Id === this.app.multiUserManager.localUser.id 
                ? chat.user2Id 
                : chat.user1Id;
            
            // Получаем имя пользователя из кэша
            const peer = this.app.multiUserManager.peers.get(otherUser);
            const name = peer?.name || otherUser;
            const avatar = peer?.avatar || '👤';
            const color = peer?.color || '#888';
            const lastMsg = chat.lastMessage || 'Нет сообщений';
            const lastMsgAt = chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString() : '';

            return `
                <div class="private-chat-item" data-user-id="${otherUser}" data-chat-id="${chat.id}">
                    <div class="private-chat-avatar" style="color:${color};">${avatar}</div>
                    <div class="private-chat-info">
                        <div class="private-chat-name">${name}</div>
                        <div class="private-chat-last">${this.sanitizeHTML(lastMsg.substring(0, 50))}</div>
                    </div>
                    <div class="private-chat-time">${lastMsgAt}</div>
                    ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
                </div>
            `;
        }).join('');

        // Обработчики клика
        container.querySelectorAll('.private-chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const peer = this.app.multiUserManager.peers.get(userId);
                if (peer) {
                    this.app.privateChat.open(peer);
                }
            });
        });
    }

    /**
     * Рендеринг бейджа непрочитанных сообщений
     */
    renderUnreadBadge() {
        const badge = document.getElementById('unreadBadge');
        if (!badge) return;

        const count = this.app.multiUserManager.unreadCount || 0;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
            badge.style.animation = 'pulse 1s infinite';
        } else {
            badge.style.display = 'none';
        }
    }

    // ... остальной код ...
}