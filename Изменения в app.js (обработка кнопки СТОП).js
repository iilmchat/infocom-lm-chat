// src/app.js
// ... остальной код ...

    // В методе setupEventListeners или в конструкторе добавьте:

    setupEventListeners() {
        // ... остальные обработчики ...

        // Глобальный обработчик для кнопки СТОП
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                // Если кнопка в состоянии "СТОП"
                if (sendBtn.classList.contains('stop-btn')) {
                    this.stopGeneration();
                }
            });
        }
    }

    /**
     * Остановка генерации
     */
    stopGeneration() {
        if (this.streamAbortController) {
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
            
            this.toast.warning('⏹ Генерация остановлена', 2000);
        }
    }

// ... остальной код ...