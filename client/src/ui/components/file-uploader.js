// src/ui/components/file-uploader.js
/**
 * Компонент для загрузки файлов с прогрессом
 * Добавлено в 5.1.
 */
export class FileUploader {
    constructor(app, options = {}) {
        this.app = app;
        this.options = {
            maxFiles: options.maxFiles || 10,
            maxSize: options.maxSize || 10 * 1024 * 1024, // 10MB
            allowedTypes: options.allowedTypes || ['*/*'],
            onUpload: options.onUpload || null,
            onError: options.onError || null,
            ...options
        };
        this.uploadedFiles = [];
        this.isUploading = false;
        this.element = null;
        this.progressBar = null;
        this.setupUI();
    }

    setupUI() {
        // Создаём контейнер для загрузки
        const container = document.createElement('div');
        container.className = 'file-uploader';
        container.innerHTML = `
            <div class="file-uploader-dropzone" id="fileDropzone">
                <div class="file-uploader-icon">📁</div>
                <div class="file-uploader-text">Перетащите файлы сюда или нажмите для выбора</div>
                <div class="file-uploader-hint">Поддерживаются: ${this.options.allowedTypes.join(', ')}</div>
                <input type="file" id="fileUploadInput" multiple style="display:none;">
            </div>
            <div class="file-uploader-list" id="fileUploadList"></div>
            <div class="file-uploader-progress" id="fileUploadProgress" style="display:none;">
                <div class="progress-bar">
                    <div class="progress-fill" id="fileProgressFill" style="width:0%"></div>
                </div>
                <div class="progress-text" id="fileProgressText">0%</div>
            </div>
        `;
        this.element = container;
        this.progressBar = container.querySelector('#fileProgressFill');
        this.progressText = container.querySelector('#fileProgressText');
        this.fileList = container.querySelector('#fileUploadList');
        this.dropzone = container.querySelector('#fileDropzone');
        this.input = container.querySelector('#fileUploadInput');

        // Обработчики событий
        this.setupEventListeners();

        // Возвращаем элемент для вставки
        return this.element;
    }

    setupEventListeners() {
        // Клик на зону для открытия диалога
        this.dropzone.addEventListener('click', () => this.input.click());

        // Drag and Drop
        this.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropzone.classList.add('dragover');
        });
        this.dropzone.addEventListener('dragleave', () => {
            this.dropzone.classList.remove('dragover');
        });
        this.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropzone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            if (files.length) {
                this.handleFiles(files);
            }
        });

        // Выбор файлов через инпут
        this.input.addEventListener('change', () => {
            if (this.input.files.length) {
                this.handleFiles(Array.from(this.input.files));
                this.input.value = '';
            }
        });
    }

    /**
     * Обработка выбранных файлов
     */
    async handleFiles(files) {
        // Проверяем лимиты
        const validFiles = [];
        for (const file of files) {
            if (this.uploadedFiles.length + validFiles.length >= this.options.maxFiles) {
                this.app.toast.warning(`Максимум ${this.options.maxFiles} файлов`);
                break;
            }
            if (file.size > this.options.maxSize) {
                this.app.toast.error(`Файл "${file.name}" превышает ${this.options.maxSize/1024/1024}MB`);
                continue;
            }
            // Проверка типа (если указаны)
            if (this.options.allowedTypes[0] !== '*/*') {
                const isAllowed = this.options.allowedTypes.some(type => {
                    if (type.endsWith('/*')) {
                        const mainType = type.split('/')[0];
                        return file.type.startsWith(mainType);
                    }
                    return file.type === type;
                });
                if (!isAllowed) {
                    this.app.toast.error(`Тип файла "${file.name}" не поддерживается`);
                    continue;
                }
            }
            validFiles.push(file);
        }

        if (!validFiles.length) return;

        // Загружаем файлы на сервер
        this.isUploading = true;
        this.showProgress(true);
        let successCount = 0;

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            try {
                const formData = new FormData();
                formData.append('file', file);
                const result = await this.app.apiService.uploadAttachment(formData);
                if (result.success) {
                    const uploaded = result.attachment;
                    this.uploadedFiles.push({
                        id: uploaded.attachmentId,
                        name: uploaded.fileName,
                        size: uploaded.fileSize,
                        type: uploaded.mimeType,
                        url: uploaded.url
                    });
                    successCount++;
                    this.renderFileItem(uploaded);
                    if (this.options.onUpload) {
                        this.options.onUpload(uploaded);
                    }
                }
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                this.app.toast.error(`Не удалось загрузить "${file.name}"`);
                if (this.options.onError) {
                    this.options.onError(error, file);
                }
            }
            // Обновляем прогресс
            const progress = ((i + 1) / validFiles.length) * 100;
            this.updateProgress(progress);
        }

        this.isUploading = false;
        this.showProgress(false);
        if (successCount > 0) {
            this.app.toast.success(`Загружено ${successCount} файлов`);
        }
    }

    /**
     * Отображение файла в списке
     */
    renderFileItem(fileData) {
        const item = document.createElement('div');
        item.className = 'file-uploader-item';
        item.dataset.id = fileData.attachmentId;
        const sizeKB = (fileData.fileSize / 1024).toFixed(1);
        const sizeMB = (fileData.fileSize / (1024 * 1024)).toFixed(1);
        const sizeStr = fileData.fileSize > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
        item.innerHTML = `
            <span class="file-item-icon">📎</span>
            <span class="file-item-name">${this.sanitizeHTML(fileData.fileName)}</span>
            <span class="file-item-size">${sizeStr}</span>
            <button class="file-item-remove" data-id="${fileData.attachmentId}">✕</button>
        `;
        this.fileList.appendChild(item);

        // Обработчик удаления
        item.querySelector('.file-item-remove').addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = e.target.dataset.id;
            await this.removeFile(id);
        });
    }

    /**
     * Удаление файла
     */
    async removeFile(attachmentId) {
        if (!confirm('Удалить файл?')) return;
        try {
            const result = await this.app.apiService.deleteAttachment(attachmentId);
            if (result.success) {
                this.uploadedFiles = this.uploadedFiles.filter(f => f.id !== attachmentId);
                const item = this.fileList.querySelector(`[data-id="${attachmentId}"]`);
                if (item) item.remove();
                this.app.toast.info('Файл удалён');
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.app.toast.error('Не удалось удалить файл');
        }
    }

    /**
     * Получить список загруженных файлов (ID)
     */
    getUploadedIds() {
        return this.uploadedFiles.map(f => f.id);
    }

    /**
     * Получить полные данные загруженных файлов
     */
    getUploadedFiles() {
        return [...this.uploadedFiles];
    }

    /**
     * Очистить список
     */
    clear() {
        this.uploadedFiles = [];
        this.fileList.innerHTML = '';
        this.updateProgress(0);
        this.showProgress(false);
    }

    showProgress(show) {
        const progressContainer = this.element.querySelector('#fileUploadProgress');
        if (progressContainer) {
            progressContainer.style.display = show ? 'block' : 'none';
        }
    }

    updateProgress(percent) {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(percent, 100)}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = `${Math.round(percent)}%`;
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}