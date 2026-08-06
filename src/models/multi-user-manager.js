// src/models/multi-user-manager.js
import { CONFIG } from '../config.js';

/**
 * Управление многопользовательским режимом
 */
export class MultiUserManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.localUser = this.loadUser();
        this.peers = new Map();
        this.isHost = false;
        this.roomId = null;
        this.simulateUsers();
    }

    loadUser() {
        const stored = localStorage.getItem('user_profile');
        if (stored) return JSON.parse(stored);

        const user = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'user_' + Math.random().toString(36).slice(2, 8),
            name: 'User_' + Math.random().toString(36).slice(2, 6),
            avatar: ['🦊', '🐱', '🐶', '🐼', '🐨', '🦁', '🐯', '🐸'][Math.floor(Math.random() * 8)],
            color: ['#7ec8e3', '#4caf50', '#9b4dca', '#f0db4f', '#dd0031', '#ff69b4'][Math.floor(Math.random() * 6)],
            lastSeen: Date.now()
        };
        localStorage.setItem('user_profile', JSON.stringify(user));
        return user;
    }

    simulateUsers() {
        if (!CONFIG.MULTI_USER.SIMULATED_USERS) return;

        const names = ['Анна', 'Петр', 'Мария', 'Иван', 'Елена'];
        const avatars = ['👩‍💻', '👨‍💻', '👩‍🔬', '👨‍🎨', '👩‍🏫'];
        const colors = ['#4caf50', '#9b4dca', '#ff69b4', '#ff9800', '#f0db4f'];

        for (let i = 0; i < CONFIG.MULTI_USER.USER_COUNT; i++) {
            const peer = {
                id: 'peer_' + i,
                name: names[i] || 'User_' + i,
                avatar: avatars[i] || '👤',
                color: colors[i] || '#888',
                online: true,
                typing: false,
                lastSeen: Date.now()
            };
            this.peers.set(peer.id, peer);
        }
        this.renderUsers();
    }

    addPeer(peer) {
        this.peers.set(peer.id, peer);
        this.renderUsers();
        if (this.eventBus) {
            this.eventBus.emit('peer:joined', peer);
        }
    }

    removePeer(id) {
        this.peers.delete(id);
        this.renderUsers();
        if (this.eventBus) {
            this.eventBus.emit('peer:left', id);
        }
    }

    setPeerTyping(id, isTyping) {
        const peer = this.peers.get(id);
        if (peer) {
            peer.typing = isTyping;
            this.renderUsers();
            if (isTyping) {
                this.showTypingNotification(peer);
            }
        }
    }

    showTypingNotification(peer) {
        const notif = document.getElementById('typingNotification');
        if (notif) {
            notif.textContent = `${peer.avatar} ${peer.name} печатает...`;
            setTimeout(() => {
                if (notif.textContent.includes(peer.name)) {
                    notif.textContent = '';
                }
            }, 3000);
        }
    }

    getUserCount() {
        return this.peers.size + 1; // +1 для локального пользователя
    }

    renderUsers() {
        const container = document.getElementById('usersOnlineList');
        const collabContainer = document.getElementById('collabUsers');
        const collabBar = document.getElementById('collaborationBar');

        if (!container) return;

        // Сайдбар
        let html = `<span class="user-badge self"><span class="user-avatar">${this.localUser.avatar}</span> ${this.sanitizeHTML(this.localUser.name)} (Вы)</span>`;
        this.peers.forEach(peer => {
            if (peer.online) {
                html += `<span class="user-badge ${peer.typing ? 'typing' : ''}" style="border-color:${peer.color};">
                        <span class="user-avatar">${peer.avatar}</span> ${this.sanitizeHTML(peer.name)}
                        ${peer.typing ? '<span class="user-status">печатает...</span>' : ''}
                    </span>`;
            }
        });
        container.innerHTML = html;

        // Коллаборационный бар
        if (collabBar && this.peers.size > 0) {
            collabBar.classList.add('active');
            if (collabContainer) {
                let collabHtml = `<span class="collab-user-dot" style="background:${this.localUser.color};" title="Вы">${this.localUser.avatar}</span>`;
                this.peers.forEach(peer => {
                    if (peer.online) {
                        collabHtml += `<span class="collab-user-dot ${peer.typing ? 'typing' : ''}" style="background:${peer.color};" title="${this.sanitizeHTML(peer.name)}">${peer.avatar}</span>`;
                    }
                });
                collabContainer.innerHTML = collabHtml;
            }
        } else if (collabBar) {
            collabBar.classList.remove('active');
        }

        // Обновляем share модалку если открыта
        const activeUsersEl = document.getElementById('activeUsers');
        if (activeUsersEl) {
            let shareHtml = `<span class="active-user-badge">${this.localUser.avatar} ${this.sanitizeHTML(this.localUser.name)} (Вы)</span>`;
            this.peers.forEach(peer => {
                shareHtml += `<span class="active-user-badge">${peer.avatar} ${this.sanitizeHTML(peer.name)}</span>`;
            });
            activeUsersEl.innerHTML = shareHtml;
        }
    }

    startSimulation() {
        setInterval(() => {
            const peers = Array.from(this.peers.values()).filter(p => p.online);
            if (peers.length > 0) {
                const randomPeer = peers[Math.floor(Math.random() * peers.length)];
                this.setPeerTyping(randomPeer.id, Math.random() > 0.7);
            }
        }, 5000);
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}