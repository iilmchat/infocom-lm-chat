// src/ui/views/settings-view.js
import { SERVER_CONFIG, CONFIG, saveServerConfig } from '../../config.js';
import { Modal } from '../components/modal.js';

/**
 * Модальное окно настроек сервера
 */
export class SettingsView {
    constructor(app) {
        this.app = app;
        this.modal = new Modal(document.getElementById('serverSettingsModal'));
        this.ipInput = document.getElementById('serverIpInput');
        this.portInput = document.getElementById('serverPortInput');
        this.ipLMInput = document.getElementById('serverIpLMInput');
        this.portLMInput = document.getElementById('serverPortLMInput');
        this.timeoutInput = document.getElementById('serverTimeoutInput');
        this.maxTokensInput = document.getElementById('serverMaxTokensInput');
        this.apiPathInput = document.getElementById('serverApiPathInput');
        this.testResult = document.getElementById('serverTestResult');

        this.setupEventListeners();
    }

    open() {
        this.loadConfigToUI();
        this.modal.open();
    }

    close() {
        this.modal.close();
    }

    loadConfigToUI() {
        this.ipInput.value = SERVER_CONFIG.ip;
        this.portInput.value = SERVER_CONFIG.port;
        this.ipLMInput.value = SERVER_CONFIG.ip_lm;
        this.portLMInput.value = SERVER_CONFIG.port_lm;
        this.timeoutInput.value = SERVER_CONFIG.timeout;
        this.maxTokensInput.value = SERVER_CONFIG.maxTokens;
        this.apiPathInput.value = SERVER_CONFIG.apiPath;
        this.testResult.className = 'test-result';
        this.testResult.style.display = 'none';
    }

    saveConfigFromUI() {
        SERVER_CONFIG.ip = this.ipInput.value.trim() || CONFIG.SERVER.DEFAULT_IP;
        SERVER_CONFIG.port = parseInt(this.portInput.value) || CONFIG.SERVER.DEFAULT_PORT;
        SERVER_CONFIG.ip_lm = this.ipLMInput.value.trim() || CONFIG.SERVER.DEFAULT_LM_IP;
        SERVER_CONFIG.port_lm = parseInt(this.portLMInput.value) || CONFIG.SERVER.LM_PORT;
        SERVER_CONFIG.timeout = parseInt(this.timeoutInput.value) || CONFIG.SERVER.DEFAULT_TIMEOUT;
        SERVER_CONFIG.maxTokens = parseInt(this.maxTokensInput.value) || CONFIG.SERVER.DEFAULT_MAX_TOKENS;
        SERVER_CONFIG.apiPath = this.apiPathInput.value.trim() || CONFIG.SERVER.DEFAULT_API_PATH;
        saveServerConfig();
        this.app.toast.success('✅ Настройки сервера сохранены');
        this.close();
        this.app.eventBus.emit('server:config_updated');
        this.app.api.checkServer();
    }

    async testConnection() {
        const ip = this.ipLMInput.value.trim() || CONFIG.SERVER.DEFAULT_LM_IP;
        const port = parseInt(this.portLMInput.value) || CONFIG.SERVER.LM_PORT;
        const timeout = parseInt(this.timeoutInput.value) || CONFIG.SERVER.DEFAULT_TIMEOUT;
        const baseUrl = `http://${ip}:${port}`;

        this.testResult.className = 'test-result';
        this.testResult.textContent = '⏳ Проверка соединения...';
        this.testResult.style.display = 'block';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

            const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                this.testResult.className = 'test-result success';
                this.testResult.textContent = '✅ Сервер доступен!';
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

    resetToDefault() {
        SERVER_CONFIG.ip = CONFIG.SERVER.DEFAULT_IP;
        SERVER_CONFIG.port = CONFIG.SERVER.DEFAULT_PORT;
        SERVER_CONFIG.ip_lm = CONFIG.SERVER.DEFAULT_LM_IP;
        SERVER_CONFIG.port_lm = CONFIG.SERVER.LM_PORT;
        SERVER_CONFIG.timeout = CONFIG.SERVER.DEFAULT_TIMEOUT;
        SERVER_CONFIG.maxTokens = CONFIG.SERVER.DEFAULT_MAX_TOKENS;
        SERVER_CONFIG.apiPath = CONFIG.SERVER.DEFAULT_API_PATH;
        saveServerConfig();
        this.loadConfigToUI();
        this.app.toast.info('Настройки сброшены к значениям по умолчанию');
    }

    setupEventListeners() {
        document.getElementById('serverSettingsBtn')?.addEventListener('click', () => this.open());
        document.getElementById('serverSettingsClose')?.addEventListener('click', () => this.close());
        document.getElementById('serverTestBtn')?.addEventListener('click', () => this.testConnection());
        document.getElementById('serverSaveBtn')?.addEventListener('click', () => this.saveConfigFromUI());
        document.getElementById('serverResetBtn')?.addEventListener('click', () => this.resetToDefault());

        // Закрытие по клику на overlay
        document.getElementById('serverSettingsModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('serverSettingsModal')) {
                this.close();
            }
        });
    }
}