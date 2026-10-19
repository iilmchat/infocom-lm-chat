// src/ui/views/export-view.js
import { Modal } from '../components/modal.js';

/**
 * Модальное окно экспорта диалога
 */
export class ExportView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('exportModal'));

        this.setupEventListeners();
    }

    open() {
        this.modal.open();
    }

    close() {
        this.modal.close();
    }

    exportChat(format) {
        const msgs = this.app.sessionManager.getMessages().filter(m => m.role !== 'system');
        if (!msgs.length) {
            this.app.toast.warning('Нет сообщений для экспорта');
            return;
        }

        const date = new Date().toLocaleString();
        let content = '';

        if (format === 'txt') {
            content = `=== Infocom LM Chat Pro v${this.app.CONFIG?.VERSION || '5.0'} ===\nDate: ${date}\nModel: ${this.app.currentModel}\nMessages: ${msgs.length}\n${'='.repeat(50)}\n\n`;
            msgs.forEach((m, i) => {
                const replyInfo = m.replyTo ? ` (ответ на: "${m.replyTo.content.substring(0, 50)}...")` : '';
                content += `${m.role === 'user' ? '👤 User' : '🤖 Assistant'} [${i + 1}]${replyInfo}:\n${m.content}\n\n`;
            });
        } else if (format === 'json') {
            content = JSON.stringify({
                version: this.app.CONFIG?.VERSION || '5.0',
                date,
                model: this.app.currentModel,
                messages: msgs
            }, null, 2);
        } else if (format === 'markdown') {
            content = `# Infocom LM Chat Pro ${this.app.CONFIG?.VERSION || '5.0'}\n\n**Date:** ${date}\n**Model:** ${this.app.currentModel}\n\n---\n\n`;
            msgs.forEach((m, i) => {
                const replyInfo = m.replyTo ? ` *(ответ на: "${m.replyTo.content.substring(0, 50)}...")*` : '';
                content += `### ${m.role === 'user' ? '👤 User' : '🤖 Assistant'} [${i + 1}]${replyInfo}\n\n${m.content}\n\n`;
            });
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = format === 'markdown' ? `chat_${Date.now()}.md` : `chat_${Date.now()}.${format}`;
        a.download = fileName;
        a.setAttribute('aria-label', `Скачать чат в формате ${format}`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.app.toast.success(`Экспорт ${format.toUpperCase()}`);
    }

    async exportPDF() {
        const msgs = this.app.sessionManager.getMessages().filter(m => m.role !== 'system');
        if (!msgs.length) {
            this.app.toast.warning('Нет сообщений для экспорта');
            return;
        }

        try {
            if (typeof html2pdf === 'undefined') {
                this.app.toast.error('Библиотека html2pdf не загружена');
                return;
            }

            this.app.toast.info('Генерация PDF...', 5000);

            const container = document.createElement('div');
            container.style.cssText = `
                padding: 20px;
                font-family: 'Segoe UI', Arial, sans-serif;
                background: white;
                color: #1a1a2e;
                max-width: 800px;
                margin: 0 auto;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 2px solid #4a90d9;
                margin-bottom: 20px;
            `;
            header.innerHTML = `
                <h1 style="margin:0;color:#1a1a2e;">💻 Infocom LM Chat</h1>
                <p style="margin:8px 0 0 0;color:#666;font-size:14px;">
                    Дата: ${new Date().toLocaleString()} | Модель: ${this.app.currentModel}
                </p>
                <p style="margin:4px 0 0 0;color:#888;font-size:12px;">
                    Сообщений: ${msgs.length}
                </p>
            `;
            container.appendChild(header);

            msgs.forEach((m, i) => {
                const msgDiv = document.createElement('div');
                msgDiv.style.cssText = `
                    margin-bottom: 16px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    background: ${m.role === 'user' ? '#e3f2fd' : '#f5f5f5'};
                    border-left: 4px solid ${m.role === 'user' ? '#4a90d9' : '#888'};
                `;

                const label = document.createElement('div');
                label.style.cssText = `
                    font-weight: 600;
                    font-size: 13px;
                    color: ${m.role === 'user' ? '#0d47a1' : '#333'};
                    margin-bottom: 6px;
                `;
                label.textContent = `${m.role === 'user' ? '👤 Вы' : '🤖 Assistant'} [${i+1}]`;
                msgDiv.appendChild(label);

                const content = document.createElement('div');
                content.style.cssText = `
                    font-size: 14px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                `;
                let cleanContent = m.content
                    .replace(/\*\*/g, '')
                    .replace(/\n/g, '<br>')
                    .replace(/```[\s\S]*?```/g, (match) => {
                        const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
                        return `<pre style="background:#f0f0f0;padding:12px;border-radius:4px;font-family:monospace;font-size:13px;overflow-x:auto;">${code}</pre>`;
                    });
                content.innerHTML = cleanContent;
                msgDiv.appendChild(content);
                container.appendChild(msgDiv);
            });

            const footer = document.createElement('div');
            footer.style.cssText = `
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid #ddd;
                text-align: center;
                color: #888;
                font-size: 12px;
            `;
            footer.textContent = 'Экспортировано из Infocom LM Chat Pro';
            container.appendChild(footer);

            const opt = {
                margin: [10, 10, 10, 10],
                filename: `chat_${Date.now()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    scrollY: 0,
                    windowHeight: container.scrollHeight
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait'
                },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            await html2pdf().set(opt).from(container).save();
            this.app.toast.success('PDF успешно экспортирован!');

        } catch (error) {
            console.error('PDF export error:', error);
            this.app.toast.error(`Ошибка экспорта PDF: ${error.message}`);
        }
    }

    setupEventListeners() {
        document.getElementById('exportBtn')?.addEventListener('click', () => this.open());
        document.getElementById('exportModalClose')?.addEventListener('click', () => this.close());

        document.getElementById('exportModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('exportModal')) {
                this.close();
            }
        });

        document.querySelectorAll('#exportModal [data-format]').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.close();
                if (format === 'pdf') {
                    setTimeout(() => this.exportPDF(), 100);
                } else {
                    setTimeout(() => this.exportChat(format), 100);
                }
            });
        });
    }
}