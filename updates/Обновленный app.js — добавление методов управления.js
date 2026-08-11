// src/app.js
class App {
    constructor() {
        // ... существующая инициализация
        
        // Инициализация UI для многопользовательского режима
        this.setupMultiUserUI();
        this.updateUserCount();
    }

    setupMultiUserUI() {
        // Кнопка подключения
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                if (this.multiUserManager.isConnected) {
                    // Отключение
                    await this.multiUserManager.leaveRoom();
                    this.toast.info('Отключено от сервера');
                    this.updateUserCount();
                    this.updateRoomInfoUI();
                } else {
                    // Подключение
                    this.toast.info('Подключение к серверу...');
                    const success = await this.multiUserManager.connectToServer();
                    if (success) {
                        this.toast.success('✅ Подключено к серверу');
                        this.updateUserCount();
                        this.updateRoomInfoUI();
                        // Загружаем историю
                        this.chatView.loadMessages();
                    } else {
                        this.toast.error('❌ Не удалось подключиться');
                    }
                }
            });
        }

        // Кнопка информации о комнате
        document.getElementById('roomInfoBtn')?.addEventListener('click', () => {
            this.openRoomInfo();
        });

        // Закрытие модалки комнаты
        document.getElementById('roomInfoModalClose')?.addEventListener('click', () => {
            document.getElementById('roomInfoModal').classList.remove('active');
        });

        // Обновление информации о комнате
        document.getElementById('roomInfoRefreshBtn')?.addEventListener('click', () => {
            this.updateRoomInfoUI();
        });

        // Выход из комнаты
        document.getElementById('roomInfoLeaveBtn')?.addEventListener('click', async () => {
            if (confirm('Выйти из комнаты?')) {
                await this.multiUserManager.leaveRoom();
                document.getElementById('roomInfoModal').classList.remove('active');
                this.toast.info('Вы вышли из комнаты');
                this.updateUserCount();
                this.updateRoomInfoUI();
            }
        });
    }

    updateUserCount() {
        const count = this.multiUserManager.peers.size + 1;
        const display = document.getElementById('userCountDisplay');
        if (display) {
            display.textContent = `👥 ${count} онлайн`;
        }
        // Обновляем sidebar
        this.multiUserManager.renderUsers();
    }

    updateRoomInfoUI() {
        const status = this.multiUserManager.getStatus();
        document.getElementById('roomInfoId').textContent = status.roomId || '—';
        document.getElementById('roomInfoName').textContent = status.roomName || '—';
        document.getElementById('roomInfoUsers').textContent = status.userCount || 0;
        document.getElementById('roomInfoMessages').textContent = status.messageCount || 0;
        document.getElementById('roomInfoStatus').textContent = status.isConnected ? '🟢 Подключен' : '⚪ Отключен';
        document.getElementById('roomInfoStatus').style.color = status.isConnected ? 'var(--success-color)' : 'var(--text-secondary)';
    }

    openRoomInfo() {
        this.updateRoomInfoUI();
        document.getElementById('roomInfoModal').classList.add('active');
    }

    // Подписка на события MultiUserManager
    setupMultiUserEvents() {
        this.eventBus.on('room:joined', (data) => {
            this.toast.success(`👥 Вошли в комнату: ${data.users?.length || 0} пользователей`);
            this.updateUserCount();
            this.updateRoomInfoUI();
        });

        this.eventBus.on('room:left', () => {
            this.toast.info('Вы вышли из комнаты');
            this.updateUserCount();
            this.updateRoomInfoUI();
        });

        this.eventBus.on('message:new', (message) => {
            this.toast.info(`💬 ${message.userName}: ${message.content?.substring(0, 50)}...`);
        });

        this.eventBus.on('users:updated', () => {
            this.updateUserCount();
        });

        this.eventBus.on('server:connected', () => {
            document.getElementById('connectBtn').textContent = '🌐 Отключиться';
            document.getElementById('connectBtn').style.color = 'var(--success-color)';
        });

        this.eventBus.on('server:disconnected', () => {
            document.getElementById('connectBtn').textContent = '🌐 Подключиться';
            document.getElementById('connectBtn').style.color = '';
        });
    }
}