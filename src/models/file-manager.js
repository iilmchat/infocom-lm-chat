// src/models/file-manager.js
/**
 * Управление файлами: загрузка, скачивание, удаление
 * Добавлено в 5.1.
 */
export class FileManager {
    constructor(app) {
        this.app = app;
        this.uploadedFiles = new Map(); // attachmentId -> { name, size, type, url }
        this.pendingUploads = new Map(); // fileId -> progress
    }

    /**
     * Загрузка файла на сервер
     * @param {File|Blob} file - Файл для загрузки
     * @param {string} messageId - ID сообщения (опционально)
     * @param {Function} onProgress - callback для отслеживания прогресса
     * @returns {Promise<Object>} - результат загрузки
     */
    async uploadFile(file, messageId = null, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (messageId) {
            formData.append('messageId', messageId);
        }

        // Используем XMLHttpRequest для отслеживания прогресса
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const fileId = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            this.pendingUploads.set(fileId, { progress: 0 });

            xhr.open('POST', `${this.app.apiService.baseUrl}/attachment/upload`, true);
            xhr.withCredentials = false;

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    this.pendingUploads.set(fileId, { progress });
                    if (onProgress) onProgress(progress);
                }
            };

            xhr.onload = () => {
                this.pendingUploads.delete(fileId);
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        if (result.success) {
                            const attachment = result.attachment;
                            this.uploadedFiles.set(attachment.attachmentId, {
                                name: attachment.fileName,
                                size: attachment.fileSize,
                                type: attachment.mimeType,
                                url: `${this.app.apiService.baseUrl}/attachment/${attachment.attachmentId}`
                            });
                            resolve(result);
                        } else {
                            reject(new Error(result.error || 'Ошибка загрузки'));
                        }
                    } catch (e) {
                        reject(new Error('Некорректный ответ сервера'));
                    }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                this.pendingUploads.delete(fileId);
                reject(new Error('Ошибка сети при загрузке'));
            };

            xhr.send(formData);
        });
    }

    /**
     * Загрузка нескольких файлов
     */
    async uploadMultipleFiles(files, messageId = null, onProgress = null) {
        const results = [];
        const total = files.length;
        let completed = 0;

        for (const file of files) {
            try {
                const result = await this.uploadFile(file, messageId, (progress) => {
                    if (onProgress) {
                        const overall = (completed + progress / 100) / total * 100;
                        onProgress(Math.round(overall));
                    }
                });
                results.push(result);
                completed++;
                if (onProgress) onProgress(Math.round((completed / total) * 100));
            } catch (error) {
                console.error('Ошибка загрузки файла:', error);
                results.push({ success: false, error: error.message, file: file.name });
            }
        }
        return results;
    }

    /**
     * Скачивание файла по ID
     */
    async downloadFile(attachmentId, fileName = null) {
        try {
            const response = await this.app.apiService.getAttachment(attachmentId);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Ошибка скачивания:', error);
            this.app.toast.error('Не удалось скачать файл');
            return false;
        }
    }

    /**
     * Удаление файла
     */
    async deleteFile(attachmentId) {
        try {
            const result = await this.app.apiService.deleteAttachment(attachmentId);
            if (result.success) {
                this.uploadedFiles.delete(attachmentId);
                return true;
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
        }
        return false;
    }

    /**
     * Получение списка файлов для сообщения
     */
    async getFilesForMessage(messageId) {
        try {
            const result = await this.app.apiService.getAttachmentsForMessage(messageId);
            if (result.success) {
                return result.attachments || [];
            }
        } catch (error) {
            console.error('Ошибка получения файлов:', error);
        }
        return [];
    }

    /**
     * Получение прогресса загрузки
     */
    getUploadProgress(fileId) {
        return this.pendingUploads.get(fileId)?.progress || 0;
    }

    /**
     * Форматирование размера файла
     */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    }
}