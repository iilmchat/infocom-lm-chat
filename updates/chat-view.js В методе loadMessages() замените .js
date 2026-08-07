loadMessages() {
    this.messagesEl.innerHTML = '';
    // Используем getMessagesWithHighlight для получения подсвеченных сообщений
    const messages = this.app.sessionManager.getMessagesWithHighlight();
    
    messages.forEach(msg => {
        if (msg.role !== 'system') {
            const replyTo = msg.replyTo ? { content: msg.replyTo.content, role: msg.replyTo.role } : null;
            const msgData = {
                role: msg.role,
                content: msg.content, // Уже с подсветкой
                replyTo: replyTo,
                isEdit: msg.isEdit || false
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