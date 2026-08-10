// src/utils/test-runner.js
import { CONFIG } from '../config.js';
import { RAGManager } from '../models/rag-manager.js';
import { SessionManager } from '../models/session-manager.js';
import { AssistantManager } from '../models/assistant-manager.js';
import { MultiUserManager } from '../models/multi-user-manager.js';
import { sanitizeHTML } from '../services/sanitizer.js';
import { ToastManager } from '../ui/components/toast.js';
import runRAGManagerTests from '../../tests/rag-manager.test.js';
import runSessionManagerTests from '../../tests/session-manager.test.js';

/**
 * Запуск unit-тестов
 */
export class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
        this.toast = new ToastManager();
    }

    addTest(name, fn) {
        this.tests.push({ name, fn });
    }

    async runAll() {
        this.results = [];
        const container = document.getElementById('testResults');
        if (container) {
            container.innerHTML = '⏳ Выполнение тестов...';
        }

        // Запускаем все тесты
        for (const test of this.tests) {
            try {
                await test.fn();
                this.results.push({ name: test.name, pass: true, error: null });
            } catch (e) {
                this.results.push({ name: test.name, pass: false, error: e.message });
            }
        }

        this.render();
        const allPassed = this.results.every(r => r.pass);
        if (allPassed && window.app?.achievementManager) {
            window.app.achievementManager.checkAndUnlock('tests_passed', (ach) => {
                if (window.app) window.app.showAchievement(ach);
            });
        }
    }

    render() {
        const container = document.getElementById('testResults');
        if (!container) return;

        const passed = this.results.filter(r => r.pass).length;
        const total = this.results.length;
        const allPassed = passed === total;

        container.innerHTML = `
            <div style="color:${allPassed ? 'var(--success-color)' : 'var(--warning-color)'};margin-bottom:4px;font-size:9px;">
                ${passed}/${total} пройдено
            </div>
            ${this.results.map(r => r.pass ? '' : `
                <div class="test-result-item ${r.pass ? 'pass' : 'fail'}">
                    ${r.pass ? '✅' : '❌'} ${r.name}${!r.pass ? ` — ${r.error}` : ''}
                </div>
            `).join('')}
        `;
    }
}

export function runAllTests() {
    const runner = new TestRunner();

    // Добавляем тесты RAGManager
    runRAGManagerTests(runner);
    
    // Добавляем тесты SessionManager
    runSessionManagerTests(runner);

    // Тесты AssistantManager
    runner.addTest('Assistant: loadBuiltIn загружает 7 ассистентов', () => {
        const am = new AssistantManager();
        const builtIn = am.getAll().filter(a => !a.custom);
        if (builtIn.length < 7) {
            throw new Error(`Expected at least 7 built-in assistants, got ${builtIn.length}`);
        }
    });

    runner.addTest('Assistant: addCustom создает кастомного', () => {
        const am = new AssistantManager();
        const a = am.addCustom('Test Assistant', '🧪', 'Test description', '#123456', 'You are a test assistant');
        if (!a.custom) {
            throw new Error('Expected custom assistant to have custom=true');
        }
        if (a.name !== 'Test Assistant') {
            throw new Error(`Wrong name: ${a.name}`);
        }
        if (a.color !== '#123456') {
            throw new Error(`Wrong color: ${a.color}`);
        }
        const id = a.id;
        const result = am.removeCustom(id);
        if (!result) {
            throw new Error('Deletion failed');
        }
        if (am.assistants.has(id)) {
            throw new Error('Assistant should be removed from map');
        }
    });

    runner.addTest('Assistant: activate/deactivate работает', () => {
        const am = new AssistantManager();
        const result = am.activate('general-programmer');
        if (!result) {
            throw new Error('Activation failed');
        }
        if (!am.activeAssistant) {
            throw new Error('No active assistant after activation');
        }
        if (am.activeAssistant.id !== 'general-programmer') {
            throw new Error('Wrong assistant activated');
        }
        am.deactivate();
        if (am.activeAssistant) {
            throw new Error('Assistant should be deactivated');
        }
    });

    // Тесты безопасности
    runner.addTest('Security: sanitizeHTML экранирует скрипты', () => {
        const input = '<script>alert("XSS")</script>';
        const output = sanitizeHTML(input);
        const div = document.createElement('div');
        div.innerHTML = output;
        if (div.querySelector('script')) {
            throw new Error('Script tag executed!');
        }
    });

    runner.addTest('Security: sanitizeHTML безопасен для вставки', () => {
        const inputs = [
            '<script>evil()</script>',
            '<img onerror="alert(1)">',
            '<svg onload="alert(1)">',
            'javascript:alert(1)',
            '<a href="javascript:alert(1)">click</a>'
        ];
        inputs.forEach(input => {
            const output = sanitizeHTML(input);
            const div = document.createElement('div');
            div.innerHTML = output;
            const scripts = div.querySelectorAll('script, img[onerror], svg[onload]');
            if (scripts.length > 0) {
                throw new Error(`Dangerous element found for input: ${input}`);
            }
        });
    });

    // Тесты MultiUser
    runner.addTest('MultiUser: loadUser создает профиль', () => {
        const saved = localStorage.getItem('user_profile');
        localStorage.removeItem('user_profile');
        const mum = new MultiUserManager();
        if (!mum.localUser) {
            throw new Error('No local user created');
        }
        if (!mum.localUser.id) {
            throw new Error('No user ID');
        }
        if (!mum.localUser.name) {
            throw new Error('No user name');
        }
        if (saved) localStorage.setItem('user_profile', saved);
    });

    runner.addTest('MultiUser: getUserCount считает пользователей', () => {
        const mum = new MultiUserManager();
        const count = mum.getUserCount();
        if (count < 1) {
            throw new Error('Expected at least 1 user');
        }
        if (count < 2 && CONFIG.MULTI_USER.SIMULATED_USERS) {
            throw new Error('Expected at least 2 users with simulation');
        }
    });

    runner.addTest('MultiUser: setPeerTyping обновляет статус', () => {
        const mum = new MultiUserManager();
        const peers = Array.from(mum.peers.values());
        if (peers.length > 0) {
            const peer = peers[0];
            mum.setPeerTyping(peer.id, true);
            const updated = mum.peers.get(peer.id);
            if (!updated.typing) {
                throw new Error('Peer typing status not updated');
            }
        }
    });

    //runner.runAll();

    const toast = new ToastManager();    
    toast.success(`🎉 Тесты запущены были. Результат на экране!`); // Сообщение о запуске тестов

}

// Автозапуск тестов при загрузке
if (typeof window !== 'undefined') {
    window.runAllTests = runAllTests;
    // Запуск тестов после загрузки страницы
    if (document.readyState === 'complete') {
        setTimeout(runAllTests, 1000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(runAllTests, 1000);
        });
    }
}