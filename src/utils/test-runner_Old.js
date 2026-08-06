// src/utils/test-runner.js
import { CONFIG } from '../config.js';
import { RAGManager } from '../models/rag-manager.js';
import { SessionManager } from '../models/session-manager.js';
import { AssistantManager } from '../models/assistant-manager.js';
import { MultiUserManager } from '../models/multi-user-manager.js';
import { sanitizeHTML } from '../services/sanitizer.js';
import { ToastManager } from '../ui/components/toast.js';

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
            ${this.results.map(r => `
                <div class="test-result-item ${r.pass ? 'pass' : 'fail'}">
                    ${r.pass ? '✅' : '❌'} ${r.name}${!r.pass ? ` — ${r.error}` : ''}
                </div>
            `).join('')}
        `;
    }
}

export function runAllTests() {
    const runner = new TestRunner();

    // Тесты RAGManager
    runner.addTest('RAG: splitIntoChunks разбивает текст', () => {
        const rag = new RAGManager();
        const chunks = rag.splitIntoChunks('Hello world. This is a test. Another sentence here.', 30);
        if (chunks.length < 2) throw new Error('Expected at least 2 chunks, got ' + chunks.length);
    });

    runner.addTest('RAG: пустой текст не создает чанки', () => {
        const rag = new RAGManager();
        const chunks = rag.splitIntoChunks('', 100);
        if (chunks.length !== 0) throw new Error('Expected 0 chunks for empty text, got ' + chunks.length);
    });

    runner.addTest('RAG: isFull возвращает true при лимите', () => {
        const rag = new RAGManager();
        rag.maxChunks = 3;
        rag.chunks = ['a', 'b', 'c'];
        if (!rag.isFull) throw new Error('Expected isFull to be true');
    });

    runner.addTest('RAG: clear очищает все данные', () => {
        const rag = new RAGManager();
        rag.chunks = ['a', 'b'];
        rag.embeddings = [[1, 2, 3], [4, 5, 6]];
        rag.fileNames = ['test.txt'];
        rag.isReady = true;
        rag.clear();
        if (rag.chunkCount !== 0) throw new Error('Expected 0 chunks after clear, got ' + rag.chunkCount);
        if (rag.isReady) throw new Error('Expected isReady to be false after clear');
    });

    runner.addTest('RAG: usagePercent вычисляется корректно', () => {
        const rag = new RAGManager();
        rag.maxChunks = 10;
        rag.chunks = ['a', 'b', 'c', 'd', 'e'];
        if (rag.usagePercent !== 50) throw new Error('Expected 50%, got ' + rag.usagePercent);
    });

    // Тесты SessionManager
    runner.addTest('Session: create создает новый чат', () => {
        const sm = new SessionManager();
        sm.sessions = [];
        const s = sm.create('Test Chat');
        if (!s) throw new Error('Session not created');
        if (s.name !== 'Test Chat') throw new Error('Wrong session name: ' + s.name);
        if (s.messages.length < 1) throw new Error('Expected at least 1 system message');
        if (s.messages[0].role !== 'system') throw new Error('First message should be system');
    });

    runner.addTest('Session: delete не удаляет последний чат', () => {
        const sm = new SessionManager();
        sm.sessions = [{ id: 1, messages: [{ role: 'system', content: 'test' }], name: 'Test', created: new Date().toISOString(), messageCount: 0 }];
        sm.currentId = 1;
        const result = sm.delete(1);
        if (result !== false) throw new Error('Should not delete last session');
        if (sm.sessions.length !== 1) throw new Error('Session count should remain 1');
    });

    runner.addTest('Session: switch переключает чат', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        sm.currentId = 1;
        const result = sm.switch(2);
        if (!result) throw new Error('Switch failed');
        if (sm.currentId !== 2) throw new Error('currentId not updated, got ' + sm.currentId);
    });

    runner.addTest('Session: addMessage увеличивает счетчик', () => {
        const sm = new SessionManager();
        sm.sessions = [{ id: 1, messages: [{ role: 'system', content: 'test' }], name: 'Test', created: new Date().toISOString(), messageCount: 0 }];
        sm.currentId = 1;
        sm.addMessage('user', 'Hello');
        const s = sm.getCurrent();
        if (s.messageCount !== 1) throw new Error('Message count not incremented, got ' + s.messageCount);
    });

    // Тесты AssistantManager
    runner.addTest('Assistant: loadBuiltIn загружает 7 ассистентов', () => {
        const am = new AssistantManager();
        const builtIn = am.getAll().filter(a => !a.custom);
        if (builtIn.length < 7) throw new Error(`Expected at least 7 built-in assistants, got ${builtIn.length}`);
    });

    runner.addTest('Assistant: addCustom создает кастомного', () => {
        const am = new AssistantManager();
        const a = am.addCustom('Test Assistant', '🧪', 'Test description', '#123456', 'You are a test assistant');
        if (!a.custom) throw new Error('Expected custom assistant to have custom=true');
        if (a.name !== 'Test Assistant') throw new Error('Wrong name: ' + a.name);
        if (a.color !== '#123456') throw new Error('Wrong color: ' + a.color);
        const id = a.id;
        const result = am.removeCustom(id);
        if (!result) throw new Error('Deletion failed');
        if (am.assistants.has(id)) throw new Error('Assistant should be removed from map');
    });

    runner.addTest('Assistant: activate/deactivate работает', () => {
        const am = new AssistantManager();
        const result = am.activate('general-programmer');
        if (!result) throw new Error('Activation failed');
        if (!am.activeAssistant) throw new Error('No active assistant after activation');
        if (am.activeAssistant.id !== 'general-programmer') throw new Error('Wrong assistant activated');
        am.deactivate();
        if (am.activeAssistant) throw new Error('Assistant should be deactivated');
    });

    // Тесты безопасности
    runner.addTest('Security: sanitizeHTML экранирует скрипты', () => {
        const input = '<script>alert("XSS")</script>';
        const output = sanitizeHTML(input);
        const div = document.createElement('div');
        div.innerHTML = output;
        if (div.querySelector('script')) throw new Error('Script tag executed!');
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
            if (scripts.length > 0) throw new Error(`Dangerous element found for input: ${input}`);
        });
    });

    // Тесты MultiUser
    runner.addTest('MultiUser: loadUser создает профиль', () => {
        const saved = localStorage.getItem('user_profile');
        localStorage.removeItem('user_profile');
        const mum = new MultiUserManager();
        if (!mum.localUser) throw new Error('No local user created');
        if (!mum.localUser.id) throw new Error('No user ID');
        if (!mum.localUser.name) throw new Error('No user name');
        if (saved) localStorage.setItem('user_profile', saved);
    });

    runner.addTest('MultiUser: getUserCount считает пользователей', () => {
        const mum = new MultiUserManager();
        const count = mum.getUserCount();
        if (count < 1) throw new Error('Expected at least 1 user');
        if (count < 2 && CONFIG.MULTI_USER.SIMULATED_USERS) throw new Error('Expected at least 2 users with simulation');
    });

    runner.addTest('MultiUser: setPeerTyping обновляет статус', () => {
        const mum = new MultiUserManager();
        const peers = Array.from(mum.peers.values());
        if (peers.length > 0) {
            const peer = peers[0];
            mum.setPeerTyping(peer.id, true);
            const updated = mum.peers.get(peer.id);
            if (!updated.typing) throw new Error('Peer typing status not updated');
        }
    });

    runner.runAll();
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