// src/app.js
// ... остальной код ...

    /**
     * Остановка генерации
     * Вызывается при нажатии кнопки СТОП
     */
    stopGeneration() {
        if (this.streamAbortController) {
            // Отменяем запрос
            this.streamAbortController.abort();
            this.streamAbortController = null;
            this.isProcessing = false;
            
            // Обновляем UI
            const sendBtn = document.getElementById('sendBtn');
            if (sendBtn) {
                sendBtn.classList.remove('stop-btn');
                sendBtn.textContent = 'Отправить';
                sendBtn.disabled = false;
            }
            
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
            
            this.toast.info('⏹ Генерация остановлена', 2000);
            console.log('🛑 Генерация остановлена пользователем');
        } else {
            // Если нет активного контроллера, но есть активные запросы в apiService
            if (this.apiService) {
                const aborted = this.apiService.abortAllRequests();
                if (aborted > 0) {
                    this.isProcessing = false;
                    this.toast.info(`⏹ Остановлено ${aborted} запросов`, 2000);
                }
            }
        }
        
        // Обновляем состояние
        this.updateStats();
    }

    /**
     * Настройка глобальных обработчиков событий
     */
    setupEventListeners() {
        // ... остальные обработчики ...

        // Обработчик для кнопки СТОП (обработка через делегирование)
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                // Если кнопка в состоянии "СТОП"
                if (sendBtn.classList.contains('stop-btn')) {
                    this.stopGeneration();
                }
            });
        }

        // Глобальная обработка клавиш для отмены
        document.addEventListener('keydown', (e) => {
            // Escape отменяет генерацию (если есть активный запрос)
            if (e.key === 'Escape' && this.isProcessing) {
                this.stopGeneration();
                e.preventDefault();
            }
        });
    }

// ... остальной код ...