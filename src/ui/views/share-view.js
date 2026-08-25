// src/ui/views/share-view.js
import { Modal } from '../components/modal.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Модальное окно для совместного доступа к чату
 */
export class ShareView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('shareModal'));
        this.shareUrl = document.getElementById('shareUrl');
        this.qrContainer = document.getElementById('qrCodeContainer');
        this.activeUsers = document.getElementById('activeUsers');

        this.setupEventListeners();
    }

    open() {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        
        if (this.shareUrl) {
            this.shareUrl.value = shareUrl;
        }
        
        if (this.qrContainer) {
            this.qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}" alt="QR-код для доступа к чату">`;
        }
        
        this.renderActiveUsers();
        this.modal.open();
        
        this.app.achievementManager.checkAndUnlock('share_first');
    }

    close() {
        this.modal.close();
    }

    renderActiveUsers() {
        if (!this.activeUsers) return;
        
        let html = `<span class="active-user-badge">${this.app.multiUserManager.localUser.Avatar} ${sanitizeHTML(this.app.multiUserManager.localUser.Name)} (Вы)</span>`;
        
        this.app.multiUserManager.peers.forEach(p => {
            html += `<span class="active-user-badge">${p.Avatar} ${sanitizeHTML(p.Name)}</span>`;
        });
        
        this.activeUsers.innerHTML = html;
    }

    copyShareUrl() {
        if (this.shareUrl) {
            this.shareUrl.select();
            navigator.clipboard.writeText(this.shareUrl.value).then(() => {
                this.app.toast.success('Ссылка скопирована!');
            });
        }
    }

    setupEventListeners() {
        document.getElementById('shareBtn')?.addEventListener('click', () => this.open());
        document.getElementById('shareModalClose')?.addEventListener('click', () => this.close());

        document.getElementById('shareModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('shareModal')) {
                this.close();
            }
        });

        // Кнопка копирования
        const copyBtn = document.querySelector('.share-url-box button');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyShareUrl());
        }
    }
}