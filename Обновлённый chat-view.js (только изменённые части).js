// src/ui/views/chat-view.js
// ... остальной код ...

    async sendMessage(action = null, extraText = null) {
        const text = extraText !== null ? extraText : this.userInput.value.trim();
        if (!text || this.app.isProcessing) return;

        // ... валидация и подготовка (без изменений) ...

        this.app.isProcessing = true;

        // ... подготовка контекста (без изменений) ...

        // Создаём AbortController для отмены запроса
        this.app.streamAbortController = new AbortController();
        const signal = this.app.streamAbortController.signal;

        this.sendBtn.textContent = '⏹ Стоп';
        this.sendBtn.classList.add('stop-btn');
        this.sendBtn.disabled = false;

        let accumulated = '';
        let isCompleted = false;
        const ragSourcesUsed = ragContext?.sources || null;

        try {
            // Передаём signal в apiService
            await this.app.apiService.sendMessage(
                payload,
                async (chunk) => {
                    // Проверяем, не был ли запрос отменён
                    if (signal.aborted) {
                        return;
                    }
                    accumulated = chunk;
                    await this.updateStreamMessage(botEl, accumulated, ragSourcesUsed);
                },
                async (final, aborted) => {
                    // Обработка завершения или отмены
                    isCompleted = true;
                    
                    if (signal.aborted || aborted) {
                        // Запрос был отменён
                        if (accumulated) {
                            const stopMsg = accumulated + '\n\n_[Прервано]_';
                            this.app.sessionManager.addMessage('assistant', stopMsg);
                            this.app.sessionManager.save();
                            await this.updateStreamMessage(botEl, stopMsg, ragSourcesUsed);
                            this.app.toast.warning('⏹ Генерация прервана');
                        } else {
                            // Удаляем пустое сообщение бота
                            const messages = this.app.sessionManager.getMessages();
                            if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                                messages.pop();
                                this.app.sessionManager.setMessages(messages);
                            }
                            botEl.remove();
                            this.app.toast.warning('⏹ Генерация прервана');
                        }
                    } else if (final) {
                        // Запрос успешно завершён
                        this.app.sessionManager.addMessage('assistant', final);
                        this.app.sessionManager.save();
                        await this.updateStreamMessage(botEl, final, ragSourcesUsed);
                        this.app.achievementManager.incrementMessage();
                        this.app.achievementManager.checkAndUnlock('first_message');
                    } else {
                        // Пустой ответ
                        const messages = this.app.sessionManager.getMessages();
                        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                            messages.pop();
                            this.app.sessionManager.setMessages(messages);
                        }
                        botEl.remove();
                        this.app.toast.warning('Пустой ответ от сервера');
                    }
                    
                    this.finishSending();
                },
                (error) => {
                    // Проверяем, не была ли это отмена
                    if (error.name === 'AbortError' || error.message === 'canceled' || error.message?.includes('abort')) {
                        // Отмена уже обработана в onComplete
                        return;
                    }
                    
                    let errMsg = '⚠️ Ошибка соединения.';
                    if (error.message.includes('429')) errMsg = '⚠️ Слишком много запросов. Подождите.';
                    else if (error.message.includes('timeout')) errMsg = '⏱️ Таймаут запроса.';
                    else if (error.message.includes('ECONNREFUSED')) errMsg = '❌ Сервер недоступен. Проверьте настройки.';
                    else if (error.message.includes('500')) errMsg = '❌ Ошибка сервера (500). Попробуйте позже.';

                    this.errorMsg.textContent = errMsg;
                    this.errorMsg.style.display = 'block';
                    if (botEl.parentNode) botEl.remove();
                    this.addMessage('bot', `❌ ${errMsg}`);
                    this.app.toast.error(errMsg);
                    
                    this.finishSending();
                },
                signal // Передаём signal в apiService
            );
        } catch (error) {
            // Проверяем, не была ли это отмена
            if (error.name === 'AbortError' || error.message === 'canceled' || error.message?.includes('abort')) {
                if (!isCompleted) {
                    this.finishSending();
                }
                return;
            }
            console.error('Send message error:', error);
            if (!isCompleted) {
                this.finishSending();
            }
        }
    }

    /**
     * Завершение отправки сообщения (очистка UI)
     */
    finishSending() {
        this.app.isProcessing = false;
        this.app.streamAbortController = null;
        
        this.sendBtn.classList.remove('stop-btn');
        this.sendBtn.textContent = 'Отправить';
        this.sendBtn.disabled = false;
        this.typingIndicator.style.display = 'none';
        
        this.app.sidebar.render();
        this.app.updateStats();
        this.focusInput();
    }

// ... остальной код ...