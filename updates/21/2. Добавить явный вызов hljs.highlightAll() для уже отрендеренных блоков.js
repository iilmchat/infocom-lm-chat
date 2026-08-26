// src/ui/views/chat-view.js
loadMessages() {
    // ... рендеринг сообщений
    this.messagesEl.innerHTML = '';
    const messages = this.app.sessionManager.getMessages();
    // ... добавление сообщений через messageRenderer

    // Добавляем кнопки копирования (уже есть)
    // И подсвечиваем все блоки кода (на случай, если markdownService не сработал)
    if (window.hljs) {
        // Подсвечиваем все блоки кода внутри контейнера
        this.messagesEl.querySelectorAll('pre code').forEach((block) => {
            // Если у блока уже есть класс hljs, пропускаем
            if (!block.classList.contains('hljs')) {
                try {
                    const language = block.className.replace('language-', '') || 'text';
                    const result = hljs.highlight(block.textContent, { language });
                    block.innerHTML = result.value;
                    block.classList.add('hljs');
                } catch (e) {
                    console.warn('Highlight fallback error:', e);
                }
            }
        });
    }

    this.scrollToBottom();
}