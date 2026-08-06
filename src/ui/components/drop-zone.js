// src/ui/components/drop-zone.js
import { CONFIG } from '../../config.js';
import { getFileText, isFileAllowed, isFileSizeValid } from '../../utils/file-helpers.js';

/**
 * Компонент Drag-and-Drop зоны
 * Поддерживает перетаскивание файлов с выбором режима
 */
export class DropZone {
    constructor(app, options = {}) {
        this.app = app;
        this.options = options;
        this.isActive = false;
        this.dragCounter = 0;
        this.currentMode = 'rag'; // 'rag' | 'attachment'
        this.pendingFiles = [];
        this.isProcessing = false;

        // DOM элементы
        this.overlay = document.getElementById('dragOverlay');
        this.icon = document.getElementById('dragIcon');
        this.text = document.querySelector('.drag-text');
        this.subtext = document.querySelector('.drag-subtext');
        this.modeSelector = document.getElementById('dragModeSelector');
        this.modeIndicator = document.getElementById('dragModeIndicator');
        this.filesPreview = document.getElementById('dragFilesPreview');
        this.progress = document.getElementById('dragProgress');
        this.progressFill = document.getElementById('dragProgressFill');
        this.statusText = document.getElementById('dragStatusText');

        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    setupEventListeners() {
        // Глобальные события для перетаскивания
        document.addEventListener('dragenter', this.handleDragEnter.bind(this));
        document.addEventListener('dragover', this.handleDragOver.bind(this));
        document.addEventListener('dragleave', this.handleDragLeave.bind(this));
        document.addEventListener('drop', this.handleDrop.bind(this));

        // Выбор режима через hover
        this.modeSelector?.addEventListener('mouseover', (e) => {
            const label = e.target.closest('label');
            if (label && this.isActive) {
                this.selectMode(label.dataset.mode);
            }
        });

        // Клик для выбора режима
        this.modeSelector?.querySelectorAll('label').forEach(label => {
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.isActive) {
                    this.selectMode(label.dataset.mode);
                }
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;

            if (e.key === '1') {
                e.preventDefault();
                this.selectMode('attachment');
                this.app.toast.info('📎 Режим: Вложение', 1000);
            } else if (e.key === '2') {
                e.preventDefault();
                this.selectMode('rag');
                this.app.toast.info('📚 Режим: RAG документ', 1000);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();

        // Проверяем, что перетаскиваются файлы
        if (!e.dataTransfer?.types?.includes('Files')) {
            return;
        }

        this.dragCounter++;

        if (this.dragCounter === 1) {
            this.open();
            this.updateFilesPreview(e.dataTransfer.files);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.isActive && e.dataTransfer?.files) {
            this.updateFilesPreview(e.dataTransfer.files);
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();

        this.dragCounter--;

        if (this.dragCounter === 0) {
            this.close();
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        this.dragCounter = 0;
        this.close();

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        // Проверяем и фильтруем файлы
        const validFiles = [];
        const totalFiles = files.length;
        let processed = 0;

        this.showProgress(`Загрузка 0/${totalFiles}...`);

        for (const file of files) {
            if (!isFileAllowed(file)) {
                this.app.toast.error(`"${file.name}" не поддерживается`);
                processed++;
                continue;
            }

            if (!isFileSizeValid(file, CONFIG.LIMITS.MAX_FILE_SIZE)) {
                this.app.toast.error(`"${file.name}" > ${CONFIG.LIMITS.MAX_FILE_SIZE/1024/1024}MB`);
                processed++;
                continue;
            }

            try {
                const content = await getFileText(file);
                validFiles.push({
                    content,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            } catch (error) {
                this.app.toast.error(`Ошибка чтения: ${file.name}`);
            }

            processed++;
            this.updateProgress((processed / totalFiles) * 100);
            this.showProgress(`Загрузка ${processed}/${totalFiles}...`);
        }

        if (!validFiles.length) {
            this.hideProgress();
            this.app.toast.warning('Нет подходящих файлов');
            return;
        }

        // Обработка файлов в зависимости от режима
        try {
            if (this.currentMode === 'attachment') {
                await this.processAsAttachments(validFiles);
            } else {
                await this.processAsRAG(validFiles);
            }
        } catch (error) {
            console.error('Ошибка обработки файлов:', error);
            this.app.toast.error(`Ошибка: ${error.message}`);
        } finally {
            this.hideProgress();
            this.pendingFiles = [];
        }
    }

    async processAsAttachments(files) {
        const maxAttachments = CONFIG.LIMITS.MAX_ATTACHMENTS;
        const currentCount = this.app.attachedFiles?.length || 0;

        if (currentCount + files.length > maxAttachments) {
            const available = maxAttachments - currentCount;
            this.app.toast.warning(`Максимум ${maxAttachments} файлов, можно добавить еще ${available}`);
            files.splice(available);
        }

        if (!files.length) return;

        this.app.attachedFiles = this.app.attachedFiles || [];
        this.app.attachedFiles.push(...files);
        this.app.updateAttachedFilesUI();
        this.app.toast.success(`📎 Прикреплено ${files.length} файлов`);
        this.showStatus(`✅ Прикреплено ${files.length} файлов`);
    }

    async processAsRAG(files) {
        if (this.app.ragManager.isFull) {
            this.app.toast.error('❌ RAG достиг лимита (500 чанков). Очистите перед загрузкой.', 4000);
            this.showStatus('❌ RAG полон');
            return;
        }

        const available = this.app.ragManager.maxChunks - this.app.ragManager.chunkCount;
        if (files.length > available) {
            this.app.toast.warning(`⚠️ Можно загрузить только ${available} документов (лимит ${this.app.ragManager.maxChunks} чанков)`, 4000);
            files.splice(available);
        }

        if (!files.length) return;

        this.showProgress('Загрузка в RAG...');
        this.updateProgress(30);

        const results = await this.app.ragManager.addDocuments(files);
        this.app.achievementManager.incrementRag(results.length);
        this.app.achievementManager.checkAndUnlock('first_rag');

        this.app.sessionManager.setRAG(this.app.ragManager.toJSON());

        this.updateProgress(100);
        this.app.toast.success(`✅ Загружено ${results.length} чанков в RAG`);
        this.showStatus(`✅ Загружено ${results.length} чанков`);

        this.app.updateRagFilesUI();
        this.app.updateStats();

        // Обновляем кнопку RAG
        const ragBtn = document.getElementById('ragBtn');
        if (ragBtn) ragBtn.style.color = 'var(--success-color)';

        // Добавляем сообщение в чат
        this.app.chatView.addMessage(
            'bot',
            `✅ Загружено ${files.length} документов в RAG контекст (${results.length} чанков).`
        );
    }

    open() {
        this.isActive = true;
        this.overlay?.classList.add('active');
        this.overlay?.setAttribute('aria-hidden', 'false');
        this.filesPreview.innerHTML = '';
        this.hideProgress();
        this.selectMode(this.currentMode || 'rag');
    }

    close() {
        this.isActive = false;
        this.overlay?.classList.remove('active');
        this.overlay?.setAttribute('aria-hidden', 'true');
        this.filesPreview.innerHTML = '';
        this.hideProgress();
        this.pendingFiles = [];
    }

    selectMode(mode) {
        this.currentMode = mode;

        // Обновляем визуальное выделение
        this.modeSelector?.querySelectorAll('label').forEach(label => {
            label.classList.toggle('selected', label.dataset.mode === mode);
        });

        // Обновляем иконку и индикатор
        if (mode === 'attachment') {
            if (this.icon) this.icon.textContent = '📎';
            if (this.modeIndicator) this.modeIndicator.textContent = 'Режим: Вложение';
        } else {
            if (this.icon) this.icon.textContent = '📚';
            if (this.modeIndicator) this.modeIndicator.textContent = 'Режим: RAG документ';
        }
    }

    updateFilesPreview(files) {
        if (!this.filesPreview) return;

        const fileList = Array.from(files);
        if (!fileList.length) {
            this.filesPreview.innerHTML = '';
            return;
        }

        this.filesPreview.innerHTML = fileList.slice(0, 5).map(f =>
            `<span class="file-preview-item">
                📄 ${this.sanitizeHTML(f.name)}
                <span class="file-size">(${(f.size / 1024).toFixed(0)}KB)</span>
            </span>`
        ).join('');

        if (fileList.length > 5) {
            this.filesPreview.innerHTML +=
                `<span class="file-preview-item">+${fileList.length - 5} ещё</span>`;
        }
    }

    showProgress(text) {
        if (this.progress) this.progress.classList.add('active');
        if (this.statusText) {
            this.statusText.classList.add('active');
            this.statusText.textContent = text || 'Загрузка...';
        }
    }

    updateProgress(percent) {
        if (this.progressFill) {
            this.progressFill.style.width = `${Math.min(percent, 100)}%`;
        }
    }

    showStatus(text) {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
    }

    hideProgress() {
        if (this.progress) this.progress.classList.remove('active');
        if (this.statusText) {
            this.statusText.classList.remove('active');
            this.statusText.textContent = '';
        }
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        document.removeEventListener('dragenter', this.handleDragEnter);
        document.removeEventListener('dragover', this.handleDragOver);
        document.removeEventListener('dragleave', this.handleDragLeave);
        document.removeEventListener('drop', this.handleDrop);
    }
}