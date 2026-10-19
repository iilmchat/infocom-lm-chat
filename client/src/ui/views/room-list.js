// src/ui/views/room-list.js
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Компонент для отображения списка общих комнат
 */
export class RoomList {
    constructor(app) {
        this.app = app;
        this.container = document.getElementById('roomList');
        this.rooms = [];
        this.currentRoomId = null;
        this.setupEventListeners();
    }

    async loadRooms() {
        try {
            const result = await this.app.apiService.getRooms();
            if (result.success) {
                this.rooms = result.rooms || [];
                this.render();
            }
        } catch (error) {
            console.error('Ошибка загрузки комнат:', error);
            this.app.toast.error('Не удалось загрузить комнаты');
        }
    }

    render() {
        if (!this.container) return;
        if (!this.rooms.length) {
            this.container.innerHTML = `
                <div style="padding:8px 16px;font-size:11px;color:var(--text-secondary);">
                    Нет общих комнат
                </div>
            `;
            return;
        }

        this.container.innerHTML = this.rooms.map(room => `
            <div class="room-item ${room.RoomId === this.currentRoomId ? 'active' : ''}" 
                 data-room-id="${room.RoomId}">
                <div class="room-info">
                    <span class="room-name">💬 ${sanitizeHTML(room.Name)}</span>
                    <span class="room-users">👥 ${room.UserCount || 0}</span>
                </div>
                <div class="room-actions">
                    <button class="room-join-btn" data-room-id="${room.RoomId}">Войти</button>
                </div>
            </div>
        `).join('');

        // Обработчики входа в комнату
        this.container.querySelectorAll('.room-join-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(btn.dataset.RoomId)
                {
                    const roomId = btn.dataset.RoomId;
                }
                else
                {
                    const roomId = btn.dataset.roomId;
                }
                //const roomId = btn.dataset.roomId;
                await this.app.multiUserManager.joinRoom(roomId);
                this.currentRoomId = roomId;
                this.render();
                this.app.chatView.loadMessages();
                this.app.toast.success(`Вошли в комнату`);
            });
        });
    }

    setupEventListeners() {
        // Кнопка "Создать комнату"
        document.getElementById('createRoomBtn')?.addEventListener('click', () => {
            const name = prompt('Введите название комнаты:');
            if (name && name.trim()) {
                this.createRoom(name.trim());
            }
        });
    }

    async createRoom(name) {
        try {
            const result = await this.app.apiService.createRoom({
                name: name,
                createdBy: this.app.multiUserManager.localUser.Id
            });
            if (result.success) {
                this.app.toast.success(`Комната "${name}" создана`);
                await this.loadRooms();
            }
        } catch (error) {
            this.app.toast.error('Ошибка создания комнаты');
        }
    }

    async searchRooms(query) {
        if (!query || query.length < 2) {
            await this.loadRooms();
            return;
        }
        try {
            const result = await this.app.apiService.searchRooms(query);
            if (result.success) {
                this.rooms = result.rooms || [];
                this.render();
            }
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }
}