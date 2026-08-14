// src/ui/views/sidebar.js
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Боковая панель со списком диалогов и статистикой
 */
export class Sidebar {
    constructor(app) {
        this.app = app;
        this.chatList = document.getElementById('chatList');
        this.chatSearch = document.getElementById('chatSearch');
        this.newChatBtn = document.getElementById('newChatBtn');
        
        this.setupEventListeners();
        this.setupSectionToggles();        
    }

    render() {
        this.renderChatList();
        this.updateStats();
        this.renderPrivateChats(); // Добавить
        this.renderUnreadBadge(); // Добавить        
        // Обновляем состояния секций после рендеринга
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
    
    /**
     * Обновляет UI секций в соответствии с сохраненными состояниями
     */
    updateSectionStates() {
        const sections = ['statsPanel', 'usersOnlinePanel', 'roadmapPanel', 'privateChatsPanel'];
        sections.forEach(id => {
            const content = document.getElementById(id);
            if (content) {
                const header = content.previousElementSibling;
                if (header && header.classList.contains('section-header')) {
                    sectionToggle.updateSectionUI(id);
                }
            }
        });
    }
        
    /**
     * Настраивает переключатели секций
     */
    setupSectionToggles() {
        // Находим все заголовки секций с onclick атрибутом
        const headers = document.querySelectorAll('.section-header[onclick]');
        headers.forEach(header => {
            // Сохраняем оригинальный onclick, если он был
            const originalOnClick = header.getAttribute('onclick');
            
            // Добавляем наш обработчик
            header.addEventListener('click', (e) => {
                // Проверяем, есть ли data-section атрибут
                const sectionId = header.dataset.section;
                if (sectionId) {
                    sectionToggle.toggle(sectionId);
                    e.preventDefault();
                } else {
                    // Если нет data-section, пытаемся найти по ID в onclick
                    const match = originalOnClick?.match(/toggleSection\('([^']+)'\)/);
                    if (match && match[1]) {
                        const id = match[1];
                        sectionToggle.toggle(id);
                        e.preventDefault();
                    }
                }
            });
        });

        // Добавляем data-section атрибуты для существующих секций
        const sectionMap = {
            'statsPanel': 'statsPanel',
            'usersOnlinePanel': 'usersOnlinePanel',
            'roadmapPanel': 'roadmapPanel',
            'privateChatsPanel': 'privateChatsPanel'
        };

        Object.entries(sectionMap).forEach(([id, dataId]) => {
            const content = document.getElementById(id);
            if (content) {
                const header = content.previousElementSibling;
                if (header && header.classList.contains('section-header')) {
                    header.dataset.section = dataId;
                }
            }
        });
    }

    renderChatList() {
        this.chatList.innerHTML = '';
        
        this.app.sessionManager.sessions.forEach(session => {
            const div = document.createElement('div');
            div.className = `chat-item${session.id === this.app.sessionManager.currentId ? ' active' : ''}`;
            div.setAttribute('role', 'button');
            div.setAttribute('aria-pressed', session.id === this.app.sessionManager.currentId);
            div.setAttribute('tabindex', '0');

            const info = document.createElement('div');
            info.style.flex = '1';
            info.style.overflow = 'hidden';

            const name = document.createElement('div');
            name.className = 'chat-name';
            name.textContent = sanitizeHTML(session.name);

            const modelBadge = document.createElement('span');
            modelBadge.className = 'chat-model-badge';
            const modelDisplay = session.model && session.model.length > 15 ? 
                sanitizeHTML(session.model.substring(0, 12)) + '...' : 
                sanitizeHTML(session.model || 'local-model');
            modelBadge.textContent = `🧠 ${modelDisplay}`;
            name.appendChild(modelBadge);
            info.appendChild(name);

            const date = document.createElement('div');
            date.className = 'chat-date';
            date.textContent = new Date(session.created).toLocaleDateString();
            info.appendChild(date);

            const actions = document.createElement('div');
            actions.className = 'chat-actions';

            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️';
            renameBtn.setAttribute('aria-label', 'Переименовать диалог');
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newName = prompt('Новое название:', session.name);
                if (newName?.trim()) {
                    this.app.sessionManager.rename(session.id, newName.trim());
                    this.render();
                }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.setAttribute('aria-label', 'Удалить диалог');
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.app.sessionManager.delete(session.id)) {
                    this.render();
                    this.app.chatView.loadMessages();
                }
            };

            actions.appendChild(renameBtn);
            actions.appendChild(deleteBtn);

            div.appendChild(info);
            div.appendChild(actions);

            div.onclick = () => {
                if (session.id !== this.app.sessionManager.currentId) {
                    this.app.sessionManager.switch(session.id);
                    
                    const ragData = this.app.sessionManager.getRAG();
                    if (ragData) {
                        this.app.ragManager.fromJSON(ragData);
                    } else {
                        this.app.ragManager.clear();
                    }
                    
                    const model = this.app.sessionManager.getModelForChat();
                    if (model) {
                        this.app.currentModel = model;
                        this.app.updateModelUI();
                    }
                    
                    this.render();
                    this.app.chatView.loadMessages();
                    this.app.updateStats();
                    this.app.updateRagFilesUI();
                }
            };

            div.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    div.onclick();
                }
            };

            this.chatList.appendChild(div);
        });

        // Поиск
        this.filterChats();
    }

    filterChats() {
        const query = this.chatSearch.value.toLowerCase();
        this.chatList.querySelectorAll('.chat-item').forEach(item => {
            const name = item.querySelector('.chat-name')?.textContent?.toLowerCase() || '';
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    }

    updateStats() {
        const statMessages = document.getElementById('statMessages');
        const statFiles = document.getElementById('statFiles');
        const statRagChunks = document.getElementById('statRagChunks');
        const statAchievements = document.getElementById('statAchievements');
        const ragProgressFill = document.getElementById('ragProgressFill');

        const messagesCount = this.app.sessionManager.getMessages()
            .filter(m => m.role !== 'system').length;
        
        if (statMessages) statMessages.textContent = messagesCount;
        if (statFiles) statFiles.textContent = this.app.attachedFiles.length;

        const chunkCount = this.app.ragManager.chunkCount;
        const maxChunks = this.app.ragManager.maxChunks;
        if (statRagChunks) statRagChunks.textContent = `${chunkCount} / ${maxChunks}`;

        const usage = this.app.ragManager.usagePercent;
        const progressPercent = Math.min(usage, 100);
        if (ragProgressFill) ragProgressFill.style.width = `${progressPercent}%`;

        if (statAchievements) {
            statAchievements.textContent = this.app.achievementManager.unlockedCount || 0;
        }
    }

    setupEventListeners() {
        // Новый чат
        this.newChatBtn.addEventListener('click', () => {
            this.app.sessionManager.create('Новый диалог', this.app.currentModel);
            this.app.ragManager.clear();
            this.app.sessionManager.setRAG(null);
            this.app.clearReplyTarget();
            this.app.updateRagFilesUI();
            this.render();
            this.app.chatView.loadMessages();
            this.app.updateStats();
            this.app.inputHistory.reset();
            this.app.toast.success('Новый диалог');
        });

        // Поиск
        this.chatSearch.addEventListener('input', () => this.filterChats());

        // Меню-переключатель для мобильных
        document.getElementById('menuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebarOverlay').classList.toggle('active');
        });

        document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });
    }
}