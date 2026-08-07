// src/ui/views/chat-view.js
import { CONFIG } from '../../config.js';
import { sanitizeHTML, validateInput, validateLength } from '../../services/sanitizer.js';
import { SyntaxHighlighter } from '../../services/syntax-highlighter.js';
import { MessageRenderer } from '../renderers/message-renderer.js';
import { copyToClipboard } from '../../utils/dom-helpers.js';

/**
 * Основное представление чата
 */
export class ChatView {
    constructor(app) {
        this.app = app;
        this.messageRenderer = new MessageRenderer();
        this.replyTarget = null;
        this.editingMessageId = null;
        this.editingOriginalContent = '';
        this.lastBotMessageEl = null;
        this.lastBotContent = '';

        // DOM элементы
        this.messagesEl = document.getElementById('messages');
        this.userInput = document.getElementById('userInput');
        this.charCounter = document.getElementById('charCounter');
        this.sendBtn = document.getElementById('sendBtn');
        this.errorMsg = document.getElementById('errorMsg');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.inputLimitWarning = document.getElementById('inputLimitWarning');
        this.fileInfo = document.getElementById('fileInfo');
        this.fileList = document.getElementById('fileList');

        this.setupEventListeners();
    }

    render() {
        this.loadMessages();
        this.updateCharCounter();
        this.updateInputPlaceholder();
    }

    loadMessages() {
        this.messagesEl.innerHTML = '';
        const messages = this.app.sessionManager.getMessages();
        
        messages.forEach(msg => {
            if (msg.role !== 'system') {
                const replyTo = msg.replyTo ? { content: msg.replyTo.content, role: msg.replyTo.role } : null;
                const msgData = {
                    role: msg.role,
                    content: msg.content,
                    replyTo: replyTo
                };
                const el = this.messageRenderer.render(msgData);
                this.messagesEl.appendChild(el);
            }
        });

        if (this.messagesEl.children.length === 0) {
            const welcome = this.messageRenderer.renderWelcome();
            this.messagesEl.appendChild(welcome);
        }

        this.scrollToBottom();
    }

    addMessage(role, content, messageId = null, files = null, ragSources = null, isEdit = false, replyTo = null) {
        const msgData = { role, content, messageId, files, ragSources, isEdit, replyTo };
        const el = this.messageRenderer.render(msgData);
        this.messagesEl.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    updateStreamMessage(el, content, ragSources = null) {
        const bubble = el.querySelector('.bubble');
        if (!bubble) return;

        bubble.innerHTML = '';
        const parts = this.messageRenderer.formatMessage(content);
        
        parts.forEach(p => {
            if (p.type === 'text') {
                const td = document.createElement('div');
                td.innerHTML = sanitizeHTML(p.content).replace(/\n/g, '<br>');
                bubble.appendChild(td);
            } else if (p.type === 'code') {
                const pre = document.createElement('pre');
                pre.innerHTML = SyntaxHighlighter.highlight(p.content, p.language);
                const btn = document.createElement('button');
                btn.className = 'copy-btn';
                btn.textContent = '📋 Копировать';
                btn.onclick = () => {
                    copyToClipboard(p.content, () => {
                        btn.textContent = '✅ Скопировано!';
                        setTimeout(() => { btn.textContent = '📋 Копировать'; }, 2000);
                    });
                };
                pre.appendChild(btn);
                bubble.appendChild(pre);
            }
        });

        if (ragSources && ragSources.length) {
            const rd = document.createElement('div');
            rd.className = 'rag-sources';
            rd.innerHTML = `<strong>📚 Источники:</strong> ${ragSources.map(s =>
                `<span style="background:var(--border-color);padding:2px 8px;border-radius:12px;margin:2px;">${sanitizeHTML(s.source)} (${(s.similarity * 100).toFixed(1)}%)</span>`
            ).join(' ')}`;
            bubble.appendChild(rd);
        }

        this.scrollToBottom();
    }

    async sendMessage(action = null, extraText = null) {
        const text = extraText !== null ? extraText : this.userInput.value.trim();
        if (!text || this.app.isProcessing) return;

        // Валидация
        const validation = validateInput(text);
        if (!validation.valid) {
            this.app.toast.error(validation.reason);
            this.userInput.classList.add('input-error');
            setTimeout(() => this.userInput.classList.remove('input-error'), 2000);
            return;
        }

        // Санитизация
        if (CONFIG.SECURITY.SANITIZE_INPUT) {
            if (!validateLength(text)) {
                this.app.toast.error(`❌ Превышен лимит символов (${CONFIG.LIMITS.MAX_INPUT_LENGTH})`, 3000);
                return;
            }
        }

        // Rate limiting
        if (!this.app.rateLimiter.isAllowed()) {
            this.app.toast.warning(`Превышен лимит запросов. Попробуйте через ${Math.ceil(this.app.rateLimiter.windowMs/1000)}с.`);
            return;
        }

        // Сохраняем историю
        if (text) {
            this.app.inputHistory.push(text);
        }

        this.app.isProcessing = true;

        // Проверка сервера
        const online = await this.app.apiService.checkServer();
        if (!online) {
            this.app.toast.error('Сервер недоступен. Проверьте настройки.');
            this.app.isProcessing = false;
            return;
        }

        // Подготовка контекста ответа
        let replyContext = null;
        if (this.replyTarget) {
            replyContext = {
                content: this.replyTarget.content,
                role: this.replyTarget.role
            };
            this.app.achievementManager.incrementReply();
            this.app.toast.success('💬 Ответ на сообщение', 1500);
            this.clearReplyTarget();
        }

        // RAG контекст
        let ragContext = null;
        if (text && this.app.ragManager.isReady && CONFIG.RAG.ENABLED) {
            if (this.app.ragManager.isFull) {
                this.app.toast.warning('⚠️ RAG достиг лимита (500 чанков). Очистите для добавления новых документов.', 4000);
            } else {
                try {
                    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('RAG timeout')), 5000));
                    const search = this.app.ragManager.getContext(text);
                    ragContext = await Promise.race([search, timeout]);
                } catch (e) {
                    console.warn('Поиск RAG произошел с ошибкой:', e);
                }
            }
        }

        // Добавляем сообщение пользователя
        const replyData = replyContext ? { content: replyContext.content, role: replyContext.role } : null;
        this.app.sessionManager.addMessage('user', text, replyData);
        const messageId = Date.now() + '_user';
        this.addMessage('user', text, messageId, this.app.attachedFiles.length ? this.app.attachedFiles : null, null, false, replyContext);

        const currentFiles = [...this.app.attachedFiles];
        this.app.attachedFiles = [];
        this.app.updateAttachedFilesUI();
        this.userInput.value = '';
        this.updateCharCounter();
        this.inputLimitWarning.classList.remove('active');
        this.app.inputHistory.reset();

        // Создаем элемент для ответа бота
        const botEl = this.addMessage('bot', '');
        botEl.classList.add('streaming');
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = '⏳ Отправка...';
        this.typingIndicator.style.display = 'block';
        this.errorMsg.style.display = 'none';

        // Подготовка промпта
        let prompt = text;

        if (action === 'review') {
            const code = currentFiles.length ? currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n') : text;
            prompt = `Сделай Code Review:\n\`\`\`\n${code}\n\`\`\``;
            this.app.achievementManager.incrementReview();
            this.app.achievementManager.checkAndUnlock('first_review');
        } else if (action === 'test') {
            const code = currentFiles.length ? currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n') : text;
            prompt = `Сгенерируй unit-тесты:\n\`\`\`\n${code}\n\`\`\``;
            this.app.achievementManager.incrementTest();
            this.app.achievementManager.checkAndUnlock('first_test');
        } else if (ragContext) {
            prompt = `${ragContext.text}\n\n---\n\nВопрос: ${text}`;
        } else if (currentFiles.length) {
            const fc = currentFiles.map(f => `Файл: ${f.name}\n${f.content}`).join('\n\n');
            prompt = `${text || 'Проанализируйте файлы'}\n\n${fc}`;
        }

        if (replyContext) {
            const author = replyContext.role === 'user' ? 'Пользователь' : 'Ассистент';
            prompt = `[Ответ на сообщение от ${author}: "${replyContext.content}"]\n\n${prompt}`;
        }

        // Системные сообщения
        const messages = [
            { role: 'system', content: CONFIG.SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ];

        if (this.app.assistantManager.activeAssistant) {
            messages.unshift({ role: 'system', content: this.app.assistantManager.getPrompt() });
        }

        const payload = {
            model: this.app.currentModel,
            messages,
            temperature: action === 'review' ? CONFIG.SERVER.REVIEW_TEMPERATURE : CONFIG.SERVER.TEMPERATURE,
            max_tokens: this.app.apiService.SERVER_CONFIG?.maxTokens || CONFIG.SERVER.DEFAULT_MAX_TOKENS,
            stream: true
        };

        this.app.streamAbortController = new AbortController();
        this.sendBtn.textContent = '⏹ Стоп';
        this.sendBtn.classList.add('stop-btn');
        this.sendBtn.disabled = false;

        let accumulated = '';
        const ragSourcesUsed = ragContext?.sources || null;

        try {
            const result = await this.app.apiService.sendMessage(
                payload,
                (chunk) => {
                    accumulated = chunk;
                    this.updateStreamMessage(botEl, accumulated, ragSourcesUsed);
                },
                (final, aborted) => {
                    if (final && !aborted) {
                        this.app.sessionManager.addMessage('assistant', final);
                        this.app.sessionManager.save();
                        this.updateStreamMessage(botEl, final, ragSourcesUsed);
                        this.app.achievementManager.incrementMessage();
                        this.app.achievementManager.checkAndUnlock('first_message');
                    } else if (aborted && accumulated) {
                        const stopMsg = accumulated + '\n\n_[Прервано]_';
                        this.app.sessionManager.addMessage('assistant', stopMsg);
                        this.app.sessionManager.save();
                        this.updateStreamMessage(botEl, stopMsg, ragSourcesUsed);
                        this.app.toast.warning('Генерация прервана');
                    } else if (aborted) {
                        this.app.sessionManager.getMessages().pop();
                        this.app.sessionManager.save();
                        botEl.remove();
                        this.app.toast.warning('Прервано');
                    } else if (!final) {
                        this.app.sessionManager.getMessages().pop();
                        this.app.sessionManager.save();
                        botEl.remove();
                        this.app.toast.warning('Пустой ответ');
                    }
                    this.app.isProcessing = false;
                    this.sendBtn.classList.remove('stop-btn');
                    this.sendBtn.textContent = 'Отправить';
                    this.sendBtn.disabled = false;
                    this.typingIndicator.style.display = 'none';
                    this.app.sidebar.render();
                    this.app.updateStats();
                    this.focusInput();
                },
                (error) => {
                    let errMsg = '⚠️ Ошибка соединения.';
                    if (error.message.includes('429')) errMsg = '⚠️ Слишком много запросов. Подождите.';
                    else if (error.message.includes('timeout')) errMsg = '⏱️ Таймаут запроса.';
                    else if (error.message.includes('ECONNREFUSED')) errMsg = '❌ Сервер недоступен. Проверьте настройки.';

                    this.errorMsg.textContent = errMsg;
                    this.errorMsg.style.display = 'block';
                    if (botEl.parentNode) botEl.remove();
                    this.addMessage('bot', `❌ ${errMsg}`);
                    this.app.toast.error(errMsg);
                    this.app.isProcessing = false;
                    this.sendBtn.classList.remove('stop-btn');
                    this.sendBtn.textContent = 'Отправить';
                    this.sendBtn.disabled = false;
                    this.typingIndicator.style.display = 'none';
                }
            );
        } catch (error) {
            console.error('Send message error:', error);
        }
    }

    setupEventListeners() {
        // Отправка по Ctrl+Enter
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.sendMessage();
            }
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                this.userInput.value += '\n';
                this.updateCharCounter();
            }
            if (e.key === 'Escape' && this.replyTarget) {
                this.clearReplyTarget();
                this.app.toast.info('Ответ отменён', 1000);
            }

            // История сообщений (Ctrl+↑ / Ctrl+↓)
            if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const currentText = this.userInput.value;
                const prev = this.app.inputHistory.getPrevious(currentText);
                if (prev !== null) {
                    this.userInput.value = prev;
                    this.userInput.selectionStart = this.userInput.selectionEnd = this.userInput.value.length;
                    this.updateCharCounter();
                }
                return;
            }

            if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const currentText = this.userInput.value;
                const next = this.app.inputHistory.getNext(currentText);
                if (next !== null) {
                    this.userInput.value = next;
                    this.userInput.selectionStart = this.userInput.selectionEnd = this.userInput.value.length;
                    this.updateCharCounter();
                }
                return;
            }
        });

        // Обновление счетчика символов
        this.userInput.addEventListener('input', () => {
            this.updateCharCounter();
            const len = this.userInput.value.length;
            if (len > CONFIG.LIMITS.MAX_INPUT_LENGTH * 0.9) {
                this.inputLimitWarning.classList.add('active');
                this.inputLimitWarning.textContent = `⚠️ Осталось ${CONFIG.LIMITS.MAX_INPUT_LENGTH - len} символов`;
            } else {
                this.inputLimitWarning.classList.remove('active');
            }
        });

        // Кнопка отправки
        this.sendBtn.addEventListener('click', () => {
            if (this.sendBtn.classList.contains('stop-btn') && this.app.streamAbortController) {
                this.app.streamAbortController.abort();
                return;
            }
            this.sendMessage();
        });

        // Кнопка Code Review
        document.getElementById('reviewBtn')?.addEventListener('click', () => {
            const text = this.userInput.value.trim();
            if (!text && !this.app.attachedFiles.length) {
                this.app.toast.warning('Введите код для анализа или прикрепите файл');
                return;
            }
            this.sendMessage('review');
        });

        // Кнопка генерации тестов
        document.getElementById('testBtn')?.addEventListener('click', () => {
            const text = this.userInput.value.trim();
            if (!text && !this.app.attachedFiles.length) {
                this.app.toast.warning('Введите код для генерации тестов или прикрепите файл');
                return;
            }
            this.sendMessage('test');
        });

        // Файловый ввод
        document.getElementById('fileBtn')?.addEventListener('click', () => {
            document.getElementById('fileInput')?.click();
        });

        document.getElementById('fileInput')?.addEventListener('change', async function() {
            const files = Array.from(this.files);
            if (!files.length) return;

            const valid = [];
            for (const f of files) {
                if (!this.app.isFileAllowed(f)) {
                    this.app.toast.error(`"${f.name}" не поддерживается`);
                    continue;
                }
                if (f.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${f.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                if (this.app.attachedFiles.length + valid.length >= CONFIG.LIMITS.MAX_ATTACHMENTS) {
                    this.app.toast.warning(`Максимум ${CONFIG.LIMITS.MAX_ATTACHMENTS} файлов`);
                    break;
                }
                try {
                    const content = await this.app.getFileText(f);
                    valid.push({ content, name: f.name, size: f.size, type: f.type });
                } catch {
                    this.app.toast.error(`Ошибка чтения "${f.name}"`);
                }
            }

            this.app.attachedFiles.push(...valid);
            this.app.updateAttachedFilesUI();
            this.value = '';
            if (valid.length) this.app.toast.success(`Загружено ${valid.length} файлов`);
        });

        // RAG ввод
        document.getElementById('ragBtn')?.addEventListener('click', () => {
            document.getElementById('ragInput')?.click();
        });

        document.getElementById('ragInput')?.addEventListener('change', async function() {
            const files = Array.from(this.files);
            if (!files.length) return;

            if (this.app.ragManager.isFull) {
                this.app.toast.error('❌ RAG достиг лимита (500 чанков). Очистите перед загрузкой.', 4000);
                this.value = '';
                return;
            }

            const valid = [];
            for (const f of files) {
                if (!this.app.isFileAllowed(f)) {
                    this.app.toast.error(`"${f.name}" не поддерживается`);
                    continue;
                }
                if (f.size > CONFIG.LIMITS.MAX_FILE_SIZE) {
                    this.app.toast.error(`"${f.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                    continue;
                }
                try {
                    const content = await this.app.getFileText(f);
                    valid.push({ content, name: f.name, size: f.size, type: f.type });
                } catch {
                    this.app.toast.error(`Ошибка чтения "${f.name}"`);
                }
            }

            if (valid.length) {
                const available = this.app.ragManager.maxChunks - this.app.ragManager.chunkCount;
                if (valid.length > available) {
                    this.app.toast.warning(`⚠️ Можно загрузить только ${available} документов`, 4000);
                }
                this.progressBar.style.display = 'block';
                this.progressFill.style.width = '30%';
                const results = await this.app.ragManager.addDocuments(valid);
                this.app.achievementManager.incrementRag(results.length);
                this.app.achievementManager.checkAndUnlock('first_rag');
                this.app.sessionManager.setRAG(this.app.ragManager.toJSON());
                this.progressFill.style.width = '100%';
                setTimeout(() => {
                    this.progressBar.style.display = 'none';
                    this.progressFill.style.width = '0%';
                }, 300);
                this.app.toast.success(`✅ Загружено ${results.length} чанков`);
                this.addMessage('bot', `✅ Загружено ${results.length} чанков (${valid.length} документов) в RAG контекст.`);
                this.app.updateRagFilesUI();
                document.getElementById('ragBtn').style.color = 'var(--success-color)';
                this.app.updateStats();
            }
            this.value = '';
        });

        // Быстрые кнопки
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.userInput.value = btn.dataset.text;
                this.userInput.focus();
                this.updateCharCounter();
                setTimeout(() => this.sendMessage(), 300);
            });
        });

        // Делегирование событий для сообщений
        this.messagesEl.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // Копирование кода
            if (target.classList.contains('copy-btn')) {
                const pre = target.closest('pre');
                if (pre) {
                    const code = pre.querySelector('code')?.textContent || '';
                    copyToClipboard(code, () => {
                        target.textContent = '✅ Скопировано!';
                        setTimeout(() => { target.textContent = '📋 Копировать'; }, 2000);
                    });
                }
                return;
            }

            // Редактирование
            if (target.textContent === '✏️') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    this.startEditing(messageDiv, content);
                }
                return;
            }

            // Ответ
            if (target.textContent === '↩️') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    const role = messageDiv.classList.contains('user') ? 'user' : 'bot';
                    this.app.setReplyTarget(messageDiv, content, role);
                }
                return;
            }

            // Перегенерация
            if (target.textContent === '↻') {
                const messageDiv = target.closest('.message');
                if (messageDiv) {
                    const content = messageDiv.querySelector('.bubble')?.textContent || '';
                    this.regenerateMessage(messageDiv, content);
                }
                return;
            }
        });
    }

    startEditing(div, content) {
        if (this.editingMessageId) {
            const prev = document.querySelector('.message.editing');
            if (prev) prev.classList.remove('editing');
            const controls = document.querySelector('.edit-controls');
            if (controls) controls.remove();
        }

        div.classList.add('editing');
        this.editingMessageId = div.dataset.messageId;
        this.editingOriginalContent = content;

        const bubble = div.querySelector('.bubble');
        const controls = document.createElement('div');
        controls.className = 'edit-controls';
        controls.innerHTML = `
            <textarea rows="3" aria-label="Редактирование сообщения">${sanitizeHTML(content)}</textarea>
            <button class="save-edit" aria-label="Сохранить">💾 Сохранить</button>
            <button class="cancel-edit" aria-label="Отмена">✕ Отмена</button>
        `;
        bubble.appendChild(controls);

        const textarea = controls.querySelector('textarea');
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

        controls.querySelector('.save-edit').onclick = () => this.saveEdit(div, textarea.value);
        controls.querySelector('.cancel-edit').onclick = () => this.cancelEdit(div);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveEdit(div, textarea.value);
            }
            if (e.key === 'Escape') {
                this.cancelEdit(div);
            }
        });
    }

    saveEdit(div, newContent) {
        if (!newContent.trim()) {
            this.app.toast.warning('Сообщение не может быть пустым');
            return;
        }

        const messages = this.app.sessionManager.getMessages();
        let msgIndex = -1;

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user' && messages[i].content === this.editingOriginalContent) {
                if (i > 0 && messages[i - 1].role === 'system') continue;
                msgIndex = i;
                break;
            }
        }

        if (msgIndex === -1) {
            this.app.toast.error('Не удалось найти сообщение для редактирования');
            this.cancelEdit(div);
            return;
        }

        messages[msgIndex].content = newContent;
        this.app.sessionManager.setMessages(messages);

        const bubble = div.querySelector('.bubble');
        const controls = bubble.querySelector('.edit-controls');
        if (controls) controls.remove();

        bubble.innerHTML = '';
        const td = document.createElement('div');
        td.textContent = newContent;
        bubble.appendChild(td);

        const ei = document.createElement('div');
        ei.className = 'edit-indicator';
        ei.textContent = '✏️ Отредактировано';
        bubble.appendChild(ei);

        div.classList.remove('editing');
        this.editingMessageId = null;
        this.editingOriginalContent = '';

        this.app.achievementManager.incrementEdit();
        this.app.achievementManager.checkAndUnlock('first_edit');
        this.app.toast.success('✏️ Сообщение обновлено');
    }

    cancelEdit(div) {
        const controls = div.querySelector('.edit-controls');
        if (controls) controls.remove();
        div.classList.remove('editing');
        this.editingMessageId = null;
        this.editingOriginalContent = '';
    }

    async regenerateMessage(div, oldContent) {
        if (this.app.isProcessing) return;
        if (!div) return;

        const allMessages = document.querySelectorAll('.message');
        let userMessage = null;

        for (let i = 0; i < allMessages.length; i++) {
            if (allMessages[i] === div) {
                for (let j = i - 1; j >= 0; j--) {
                    if (allMessages[j].classList.contains('user')) {
                        userMessage = allMessages[j];
                        break;
                    }
                }
                break;
            }
        }

        if (!userMessage) {
            this.app.toast.warning('Не найдено сообщение пользователя для перегенерации');
            return;
        }

        const userText = userMessage.querySelector('.bubble')?.textContent || '';
        if (!userText.trim()) return;

        div.remove();

        const messages = this.app.sessionManager.getMessages();
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                messages.splice(i, 1);
                break;
            }
        }
        this.app.sessionManager.setMessages(messages);

        this.userInput.value = userText;
        await this.sendMessage(null, userText);
        this.userInput.value = '';
        this.updateCharCounter();

        this.app.achievementManager.incrementRegenerate();
        this.app.achievementManager.checkAndUnlock('first_regenerate');
        this.app.toast.info('↻ Ответ перегенерирован');
    }

    clearReplyTarget() {
        this.replyTarget = null;
        this.app.clearReplyTarget();
    }

    updateCharCounter() {
        const len = this.userInput.value.length;
        const max = CONFIG.MESSAGE.MAX_LENGTH;
        this.charCounter.textContent = `${len} / ${max}`;
        this.charCounter.className = 'char-counter';
        if (len > CONFIG.MESSAGE.MAX_LENGTH * CONFIG.MESSAGE.WARNING_THRESHOLD) {
            this.charCounter.classList.add('warning');
        }
        if (len > max) this.charCounter.classList.add('exceeded');
    }

    updateInputPlaceholder() {
        // Плейсхолдер устанавливается через app.setReplyTarget
    }

    scrollToBottom() {
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    focusInput() {
        this.userInput.focus();
    }
}