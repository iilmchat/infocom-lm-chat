// src/ui/views/sidebar.js
import { sanitizeHTML } from '../../services/sanitizer.js';
import { RoomList } from './room-list.js';

/**
 * Боковая панель со списком диалогов и статистикой
 * Изменено в 5.1: добавлены общие комнаты
 */
/* Изменено в 5.3 — добавлен рендеринг Workspaces */

export class Sidebar {
    constructor(app) {
        this.app = app;
        this.chatList = document.getElementById('chatList');
        this.chatSearch = document.getElementById('chatSearch');
        this.newChatBtn = document.getElementById('newChatBtn');

        // Добавлено в 5.1: инициализация компонента списка комнат
        this.roomList = new RoomList(app);
        
        this.setupEventListeners();
        this.setupSectionToggles();

        this.renderWorkspaces();   /* Добавлено в 5.3 */                
    }

    render() {
        this.renderChatList();
        this.updateStats();
        this.renderPrivateChats();
        this.renderUnreadBadge();
        // Добавлено в 5.1: загрузка комнат
        this.roomList.loadRooms();
        this.renderWorkspaces();   /* Добавлено в 5.3 */        
        // Обновляем состояния секций после рендеринга
        this.updateSectionStates();        
    }

    /* Добавлено в 5.3 */
    renderWorkspaces() {
        const container = document.getElementById('workspaceList');
        if (!container) return;
        const wsManager = this.app.multiUserManager.workspaceManager;
        const workspaces = wsManager.getAllWorkspaces();
        const current = wsManager.getCurrentWorkspace();
        container.innerHTML = workspaces.map(ws => `
            <div class="workspace-item ${ws.id === current.id ? 'active' : ''}" data-workspace-id="${ws.id}">
                <span>📁 ${sanitizeHTML(ws.name)}</span>
                ${ws.id !== current.id ? `<button class="ws-delete" data-id="${ws.id}">✕</button>` : ''}
            </div>
        `).join('');
        container.querySelectorAll('.workspace-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.workspaceId;
                if (id !== current.id) {
                    wsManager.switchWorkspace(id);
                    // Обновляем UI (при событии workspace:switched)
                    this.render();
                    this.app.chatView.loadMessages();
                }
            });
            const delBtn = item.querySelector('.ws-delete');
            if (delBtn) {
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = delBtn.dataset.id;
                    if (confirm('Удалить рабочее пространство?')) {
                        wsManager.deleteWorkspace(id);
                        this.renderWorkspaces();
                        this.render();
                    }
                });
            }
        });
        // Кнопка создания
        document.getElementById('createWorkspaceBtn')?.addEventListener('click', () => {
            const name = prompt('Название рабочего пространства:');
            if (name) {
                wsManager.createWorkspace(name.trim());
                this.renderWorkspaces();
                this.render();
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
    
    /**
     * Рендеринг приватных чатов в sidebar
     * Добавлено в 5.1.
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

        // Создаем массив для хранения результатов
        const enrichedChats = [];

        // Используем обычный цикл for...of, в котором await работает напрямую
        for (const chat of chats) {
            const otherUser = chat.User1Id === this.app.multiUserManager.localUser.Id 
                ? chat.User2Id 
                : chat.User1Id;

            // Ждем выполнения запроса на каждой итерации
            const userDetails = await this.app.multiUserManager.api.getUser(otherUser);
            
            enrichedChats.push({ chat, userDetails });
        }

        container.innerHTML = enrichedChats.map(({ chat, userDetails }) => {
            //const otherUser = chat.User1Id === this.app.multiUserManager.localUser.Id 
            //    ? chat.User2Id 
            //    : chat.User1Id;
 

            // Получаем имя пользователя из кэша
            let peer = userDetails.user;//this.app.multiUserManager.peers.get(otherUser);
            /*
            if(!peer || peer === 'undefined')
            {

                if (result1.success) {
                    peer = result1.user;
                }
            }
                */
            const name = peer?.Name|| peer.Id;
            const avatar = peer?.Avatar || '👤';
            const peerAvatar = this.app.avatarService.getAvatarHTML({ 
                name: name, 
                avatarType: peer?.AvatarType, 
                avatarData: peer?.AvatarData,
                color: peer?.Color || '#888'
            });            
            const color = peer?.Color || '#888';
            const lastMsg = chat.LastMessage || 'Нет сообщений';
            const lastMsgAt = chat.LastMessageAt ? new Date(chat.LastMessageAt).toLocaleTimeString() : '';

            return `
                <div class="private-chat-item" data-user-id="${peer.Id}" data-chat-id="${chat.ChatId}">
                    <div class="private-chat-avatar">${peerAvatar}</div>
                    <div class="private-chat-info">
                        <div class="private-chat-name">${sanitizeHTML(name)}</div>
                        <div class="private-chat-last">${sanitizeHTML(lastMsg.substring(0, 50))}</div>
                    </div>
                    <div class="private-chat-time">${lastMsgAt}</div>
                    ${peer.UnreadCount > 0 ? `<span class="unread-badge">${peer.UnreadCount}</span>` : ''}
                </div>
            `;
        }).join('');

        // Обработчики клика
        /* Изменено в 6.2: клик по приватному чату — навигация на /private с открытием чата (KI-003) */
        container.querySelectorAll('.private-chat-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.userId;
                const chatId = item.dataset.chatId;
                if (chatId && userId) {
                    this.app.openPrivateChatById(chatId, userId);
                }
            });
        });
    }

    /**
     * Рендеринг бейджа непрочитанных сообщений
     * Добавлено в 5.1.
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
        const sections = ['statsPanel', 'usersOnlinePanel', 'roadmapPanel', 'privateChatsPanel', 'roomsPanel'];
        sections.forEach(id => {
            const content = document.getElementById(id);
            if (content) {
                const header = content.previousElementSibling;
                if (header && header.classList.contains('section-header')) {
                    // Используем глобальный sectionToggle
                    if (window.sectionToggle) {
                        window.sectionToggle.updateSectionUI(id);
                    }
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
                    //sectionToggle.toggle(sectionId);
                    if (window.sectionToggle) {
                        window.sectionToggle.toggle(sectionId);
                    }                    
                    e.preventDefault();
                } else {
                    // Если нет data-section, пытаемся найти по ID в onclick
                    const match = originalOnClick?.match(/toggleSection\('([^']+)'\)/);
                    if (match && match[1]) {
                        const id = match[1];
                        if (window.sectionToggle) {
                            window.sectionToggle.toggle(id);
                        }
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
            'privateChatsPanel': 'privateChatsPanel',
            'roomsPanel': 'roomsPanel'
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

        // Добавлено в 5.1: кнопка создания нового приватного чата
        document.getElementById('newPrivateChatBtn')?.addEventListener('click', () => {
            this.app.privateChat.showUserSelector();
        });        
    }
}