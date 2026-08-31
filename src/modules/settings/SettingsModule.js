// src/modules/settings/SettingsModule.js
/* Добавлено в 6.1: модуль настроек сервера (полноэкранная страница) */

import { SERVER_CONFIG, CONFIG, saveServerConfig, loadServerConfig } from '../../config.js';
import { sanitizeHTML } from '../../services/sanitizer.js';

export class SettingsModule {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div style="max-width:600px; margin:0 auto; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2>⚙️ Настройки сервера</h2>
                    <button id="settingsBackBtn" class="btn btn-secondary" data-link="/">← Назад в чат</button>
                </div>

                <div class="settings-form">
                    <div class="form-group">
                        <label for="settingsIp">IP-адрес сервера (API)</label>
                        <input type="text" id="settingsIp" placeholder="localhost" value="${sanitizeHTML(SERVER_CONFIG.ip)}">
                    </div>
                    <div class="form-group">
                        <label for="settingsPort">Порт (API)</label>
                        <input type="number" id="settingsPort" placeholder="8032" value="${SERVER_CONFIG.port}" min="1" max="65535">
                    </div>
                    <div class="form-group">
                        <label for="settingsIpLm">IP-адрес сервера с моделью (LM Studio)</label>
                        <input type="text" id="settingsIpLm" placeholder="222.1.1.31" value="${sanitizeHTML(SERVER_CONFIG.ip_lm)}">
                    </div>
                    <div class="form-group">
                        <label for="settingsPortLm">Порт (LM Studio)</label>
                        <input type="number" id="settingsPortLm" placeholder="8034" value="${SERVER_CONFIG.port_lm}" min="1" max="65535">
                    </div>
                    <div class="form-group">
                        <label for="settingsTimeout">Таймаут (сек)</label>
                        <input type="number" id="settingsTimeout" placeholder="60" value="${SERVER_CONFIG.timeout}" min="5" max="300">
                    </div>
                    <div class="form-group">
                        <label for="settingsMaxTokens">Макс. токенов</label>
                        <input type="number" id="settingsMaxTokens" placeholder="2048" value="${SERVER_CONFIG.maxTokens}" min="256" max="8192">
                    </div>
                    <div class="form-group">
                        <label for="settingsApiPath">Путь к API</label>
                        <input type="text" id="settingsApiPath" placeholder="/v1/chat/completions" value="${sanitizeHTML(SERVER_CONFIG.apiPath)}">
                    </div>

                    <div id="settingsTestResult" class="test-result" style="display:none;"></div>

                    <div class="settings-actions" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;">
                        <button id="settingsTestBtn" class="btn btn-secondary">🔍 Проверить соединение</button>
                        <button id="settingsSaveBtn" class="btn btn-primary">💾 Сохранить</button>
                        <button id="settingsResetBtn" class="btn btn-secondary">↺ Сбросить</button>
                    </div>
                </div>
            </div>
        `;

        // Сохраняем ссылки
        this.ipInput = document.getElementById('settingsIp');
        this.portInput = document.getElementById('settingsPort');
        this.ipLmInput = document.getElementById('settingsIpLm');
        this.portLmInput = document.getElementById('settingsPortLm');
        this.timeoutInput = document.getElementById('settingsTimeout');
        this.maxTokensInput = document.getElementById('settingsMaxTokens');
        this.apiPathInput = document.getElementById('settingsApiPath');
        this.testResult = document.getElementById('settingsTestResult');
    }

    setupEventListeners() {
        // Кнопка "Назад"
        document.getElementById('settingsBackBtn')?.addEventListener('click', () => {
            this.app.router.navigate('/');
        });

        // Тест соединения
        document.getElementById('settingsTestBtn')?.addEventListener('click', () => {
            this.testConnection();
        });

        // Сохранение
        document.getElementById('settingsSaveBtn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Сброс
        document.getElementById('settingsResetBtn')?.addEventListener('click', () => {
            this.resetSettings();
        });
    }

    async testConnection() {
        const ipLm = this.ipLmInput.value.trim() || CONFIG.SERVER.DEFAULT_LM_IP;
        const portLm = parseInt(this.portLmInput.value) || CONFIG.SERVER.LM_PORT;
        const timeout = parseInt(this.timeoutInput.value) || CONFIG.SERVER.DEFAULT_TIMEOUT;

        this.testResult.style.display = 'block';
        this.testResult.className = 'test-result';
        this.testResult.textContent = '⏳ Проверка соединения...';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
            const baseUrl = `http://${ipLm}:${portLm}`;
            const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                this.testResult.className = 'test-result success';
                this.testResult.textContent = '✅ Сервер доступен!';
                // Попробуем получить модели
                try {
                    const modelsRes = await fetch(`${baseUrl}/v1/models`, { signal: controller.signal });
                    if (modelsRes.ok) {
                        const data = await modelsRes.json();
                        const count = data?.data?.length || 0;
                        this.testResult.textContent += ` Найдено моделей: ${count}`;
                    }
                } catch {}
            } else {
                this.testResult.className = 'test-result error';
                this.testResult.textContent = `❌ Ошибка HTTP ${response.status}`;
            }
        } catch (e) {
            this.testResult.className = 'test-result error';
            this.testResult.textContent = `❌ Ошибка: ${e.message || 'Сервер недоступен'}`;
        }
    }

    saveSettings() {
        const ip = this.ipInput.value.trim() || CONFIG.SERVER.DEFAULT_IP;
        const port = parseInt(this.portInput.value) || CONFIG.SERVER.DEFAULT_PORT;
        const ipLm = this.ipLmInput.value.trim() || CONFIG.SERVER.DEFAULT_LM_IP;
        const portLm = parseInt(this.portLmInput.value) || CONFIG.SERVER.LM_PORT;
        const timeout = parseInt(this.timeoutInput.value) || CONFIG.SERVER.DEFAULT_TIMEOUT;
        const maxTokens = parseInt(this.maxTokensInput.value) || CONFIG.SERVER.DEFAULT_MAX_TOKENS;
        const apiPath = this.apiPathInput.value.trim() || CONFIG.SERVER.DEFAULT_API_PATH;

        // Обновляем глобальный объект
        SERVER_CONFIG.ip = ip;
        SERVER_CONFIG.port = port;
        SERVER_CONFIG.ip_lm = ipLm;
        SERVER_CONFIG.port_lm = portLm;
        SERVER_CONFIG.timeout = timeout;
        SERVER_CONFIG.maxTokens = maxTokens;
        SERVER_CONFIG.apiPath = apiPath;

        saveServerConfig();
        this.app.toast.success('✅ Настройки сервера сохранены');
        this.app.eventBus.emit('server:config_updated');
        // Проверяем соединение
        this.testConnection();
    }

    resetSettings() {
        SERVER_CONFIG.ip = CONFIG.SERVER.DEFAULT_IP;
        SERVER_CONFIG.port = CONFIG.SERVER.DEFAULT_PORT;
        SERVER_CONFIG.ip_lm = CONFIG.SERVER.DEFAULT_LM_IP;
        SERVER_CONFIG.port_lm = CONFIG.SERVER.LM_PORT;
        SERVER_CONFIG.timeout = CONFIG.SERVER.DEFAULT_TIMEOUT;
        SERVER_CONFIG.maxTokens = CONFIG.SERVER.DEFAULT_MAX_TOKENS;
        SERVER_CONFIG.apiPath = CONFIG.SERVER.DEFAULT_API_PATH;
        saveServerConfig();
        // Обновляем поля
        this.ipInput.value = SERVER_CONFIG.ip;
        this.portInput.value = SERVER_CONFIG.port;
        this.ipLmInput.value = SERVER_CONFIG.ip_lm;
        this.portLmInput.value = SERVER_CONFIG.port_lm;
        this.timeoutInput.value = SERVER_CONFIG.timeout;
        this.maxTokensInput.value = SERVER_CONFIG.maxTokens;
        this.apiPathInput.value = SERVER_CONFIG.apiPath;
        this.app.toast.info('Настройки сброшены к значениям по умолчанию');
        this.testResult.style.display = 'none';
    }
}