// tests/session-manager.test.js
import { SessionManager } from '../src/models/session-manager.js';
import { CONFIG } from '../src/config.js';

/**
 * Тесты для SessionManager
 * Запускаются через TestRunner
 */
export function runSessionManagerTests(runner) {
    // Тест 1: create создает новый чат с системным сообщением
    runner.addTest('Session: create создает новый чат', () => {
        const sm = new SessionManager();
        sm.sessions = []; // Очищаем перед тестом
        
        const session = sm.create('Test Chat');
        
        if (!session) {
            throw new Error('Session not created');
        }
        if (session.name !== 'Test Chat') {
            throw new Error(`Wrong session name: ${session.name}`);
        }
        if (session.messages.length < 1) {
            throw new Error('Expected at least 1 system message');
        }
        if (session.messages[0].role !== 'system') {
            throw new Error('First message should be system');
        }
        if (!session.id) {
            throw new Error('Session should have an id');
        }
        if (!session.created) {
            throw new Error('Session should have created date');
        }
    });

    // Тест 2: create использует переданную модель
    runner.addTest('Session: create использует переданную модель', () => {
        const sm = new SessionManager();
        sm.sessions = [];
        
        const session = sm.create('Test Chat', 'test-model-123');
        
        if (session.model !== 'test-model-123') {
            throw new Error(`Expected model "test-model-123", got "${session.model}"`);
        }
    });

    // Тест 3: create использует модель по умолчанию
    runner.addTest('Session: create использует модель по умолчанию', () => {
        const sm = new SessionManager();
        sm.sessions = [];
        sm.defaultModel = 'default-model';
        
        const session = sm.create('Test Chat');
        
        if (session.model !== 'default-model') {
            throw new Error(`Expected default model "default-model", got "${session.model}"`);
        }
    });

    // Тест 4: getCurrent возвращает текущую сессию
    runner.addTest('Session: getCurrent возвращает текущую сессию', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        sm.currentId = 2;
        
        const current = sm.getCurrent();
        
        if (!current) {
            throw new Error('Current session not found');
        }
        if (current.id !== 2) {
            throw new Error(`Expected session id 2, got ${current.id}`);
        }
    });

    // Тест 5: getCurrent возвращает первую сессию, если текущая не найдена
    runner.addTest('Session: getCurrent возвращает первую сессию при отсутствии текущей', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        sm.currentId = 999; // Несуществующий ID
        
        const current = sm.getCurrent();
        
        if (!current) {
            throw new Error('Current session not found');
        }
        if (current.id !== 1) {
            throw new Error(`Expected first session id 1, got ${current.id}`);
        }
    });

    // Тест 6: getMessages возвращает сообщения текущей сессии
    runner.addTest('Session: getMessages возвращает сообщения', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }],
                name: 'Chat 1',
                created: new Date().toISOString()
            }
        ];
        sm.currentId = 1;
        
        const messages = sm.getMessages();
        
        if (messages.length !== 2) {
            throw new Error(`Expected 2 messages, got ${messages.length}`);
        }
        if (messages[0].content !== 'Hello') {
            throw new Error('First message content mismatch');
        }
        if (messages[1].content !== 'Hi') {
            throw new Error('Second message content mismatch');
        }
    });

    // Тест 7: getMessages возвращает пустой массив при отсутствии сессии
    runner.addTest('Session: getMessages возвращает пустой массив при отсутствии сессии', () => {
        const sm = new SessionManager();
        sm.sessions = [];
        
        const messages = sm.getMessages();
        
        if (messages.length !== 0) {
            throw new Error(`Expected empty array, got ${messages.length} messages`);
        }
    });

    // Тест 8: setMessages обновляет сообщения текущей сессии
    runner.addTest('Session: setMessages обновляет сообщения', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString()
            }
        ];
        sm.currentId = 1;
        
        const newMessages = [{ role: 'user', content: 'Test' }];
        sm.setMessages(newMessages);
        
        const messages = sm.getMessages();
        
        if (messages.length !== 1) {
            throw new Error(`Expected 1 message, got ${messages.length}`);
        }
        if (messages[0].content !== 'Test') {
            throw new Error('Message content mismatch');
        }
    });

    // Тест 9: addMessage добавляет сообщение в сессию
    runner.addTest('Session: addMessage добавляет сообщение', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [{ role: 'system', content: 'System' }],
                name: 'Chat 1',
                created: new Date().toISOString(),
                messageCount: 0
            }
        ];
        sm.currentId = 1;
        
        sm.addMessage('user', 'Hello');
        
        const messages = sm.getMessages();
        
        if (messages.length !== 2) {
            throw new Error(`Expected 2 messages, got ${messages.length}`);
        }
        if (messages[1].role !== 'user') {
            throw new Error('Message role should be "user"');
        }
        if (messages[1].content !== 'Hello') {
            throw new Error('Message content mismatch');
        }
    });

    // Тест 10: addMessage увеличивает счетчик сообщений для пользователя
    runner.addTest('Session: addMessage увеличивает счетчик для пользователя', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [{ role: 'system', content: 'System' }],
                name: 'Chat 1',
                created: new Date().toISOString(),
                messageCount: 0
            }
        ];
        sm.currentId = 1;
        
        sm.addMessage('user', 'Hello');
        const session = sm.getCurrent();
        
        if (session.messageCount !== 1) {
            throw new Error(`Expected messageCount 1, got ${session.messageCount}`);
        }
    });

    // Тест 11: addMessage не увеличивает счетчик для ассистента
    runner.addTest('Session: addMessage не увеличивает счетчик для ассистента', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [{ role: 'system', content: 'System' }],
                name: 'Chat 1',
                created: new Date().toISOString(),
                messageCount: 0
            }
        ];
        sm.currentId = 1;
        
        sm.addMessage('assistant', 'Hello');
        const session = sm.getCurrent();
        
        if (session.messageCount !== 0) {
            throw new Error(`Expected messageCount 0, got ${session.messageCount}`);
        }
    });

    // Тест 12: delete не удаляет последний чат
    runner.addTest('Session: delete не удаляет последний чат', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [{ role: 'system', content: 'System' }],
                name: 'Chat 1',
                created: new Date().toISOString(),
                messageCount: 0
            }
        ];
        sm.currentId = 1;
        
        const result = sm.delete(1);
        
        if (result !== false) {
            throw new Error('Should not delete last session');
        }
        if (sm.sessions.length !== 1) {
            throw new Error('Session count should remain 1');
        }
    });

    // Тест 13: delete удаляет чат, если есть другие
    runner.addTest('Session: delete удаляет чат при наличии других', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        sm.currentId = 2;
        
        const result = sm.delete(2);
        
        if (result !== true) {
            throw new Error('Delete should succeed');
        }
        if (sm.sessions.length !== 1) {
            throw new Error(`Expected 1 session, got ${sm.sessions.length}`);
        }
        if (sm.sessions[0].id !== 1) {
            throw new Error('Remaining session should be id 1');
        }
    });

    // Тест 14: delete устанавливает новую текущую сессию при удалении текущей
    runner.addTest('Session: delete обновляет currentId при удалении текущей', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() },
            { id: 3, messages: [], name: 'Chat 3', created: new Date().toISOString() }
        ];
        sm.currentId = 2;
        
        sm.delete(2);
        
        if (sm.currentId !== 1) {
            throw new Error(`Expected currentId 1, got ${sm.currentId}`);
        }
    });

    // Тест 15: switch переключает на другую сессию
    runner.addTest('Session: switch переключает чат', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        sm.currentId = 1;
        
        const result = sm.switch(2);
        
        if (!result) {
            throw new Error('Switch failed');
        }
        if (sm.currentId !== 2) {
            throw new Error(`currentId not updated, got ${sm.currentId}`);
        }
    });

    // Тест 16: switch возвращает false при несуществующем ID
    runner.addTest('Session: switch возвращает false при несуществующем ID', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() }
        ];
        sm.currentId = 1;
        
        const result = sm.switch(999);
        
        if (result !== false) {
            throw new Error('Switch should return false for invalid id');
        }
        if (sm.currentId !== 1) {
            throw new Error('currentId should not change');
        }
    });

    // Тест 17: rename изменяет название сессии
    runner.addTest('Session: rename изменяет название', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Old Name', created: new Date().toISOString() }
        ];
        
        const result = sm.rename(1, 'New Name');
        
        if (!result) {
            throw new Error('Rename failed');
        }
        if (sm.sessions[0].name !== 'New Name') {
            throw new Error(`Expected "New Name", got "${sm.sessions[0].name}"`);
        }
    });

    // Тест 18: rename возвращает false при несуществующем ID
    runner.addTest('Session: rename возвращает false при несуществующем ID', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() }
        ];
        
        const result = sm.rename(999, 'New Name');
        
        if (result !== false) {
            throw new Error('Rename should return false for invalid id');
        }
    });

    // Тест 19: getRAG возвращает данные RAG из сессии
    runner.addTest('Session: getRAG возвращает данные RAG', () => {
        const sm = new SessionManager();
        const ragData = { chunks: ['test'], embeddings: [[1, 2, 3]] };
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                ragData: ragData
            }
        ];
        sm.currentId = 1;
        
        const result = sm.getRAG();
        
        if (!result) {
            throw new Error('getRAG returned null');
        }
        if (result.chunks[0] !== 'test') {
            throw new Error('RAG data mismatch');
        }
    });

    // Тест 20: setRAG устанавливает данные RAG в сессию
    runner.addTest('Session: setRAG устанавливает данные RAG', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                ragData: null
            }
        ];
        sm.currentId = 1;
        
        const ragData = { chunks: ['test'], embeddings: [[1, 2, 3]] };
        sm.setRAG(ragData);
        
        const session = sm.getCurrent();
        if (!session.ragData) {
            throw new Error('RAG data not set');
        }
        if (session.ragData.chunks[0] !== 'test') {
            throw new Error('RAG data mismatch');
        }
    });

    // Тест 21: getModelForChat возвращает модель сессии
    runner.addTest('Session: getModelForChat возвращает модель', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                model: 'test-model'
            }
        ];
        sm.currentId = 1;
        
        const model = sm.getModelForChat();
        
        if (model !== 'test-model') {
            throw new Error(`Expected "test-model", got "${model}"`);
        }
    });

    // Тест 22: getModelForChat возвращает модель по ID
    runner.addTest('Session: getModelForChat возвращает модель по ID', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString(), model: 'model-1' },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString(), model: 'model-2' }
        ];
        
        const model = sm.getModelForChat(2);
        
        if (model !== 'model-2') {
            throw new Error(`Expected "model-2", got "${model}"`);
        }
    });

    // Тест 23: getModelForChat возвращает default при отсутствии модели
    runner.addTest('Session: getModelForChat возвращает default при отсутствии модели', () => {
        const sm = new SessionManager();
        sm.defaultModel = 'default-model';
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                model: null
            }
        ];
        sm.currentId = 1;
        
        const model = sm.getModelForChat();
        
        if (model !== 'default-model') {
            throw new Error(`Expected "default-model", got "${model}"`);
        }
    });

    // Тест 24: setModelForChat устанавливает модель для сессии
    runner.addTest('Session: setModelForChat устанавливает модель', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                model: 'old-model'
            }
        ];
        sm.currentId = 1;
        
        const result = sm.setModelForChat('new-model');
        
        if (!result) {
            throw new Error('setModelForChat failed');
        }
        const session = sm.getCurrent();
        if (session.model !== 'new-model') {
            throw new Error(`Expected "new-model", got "${session.model}"`);
        }
    });

    // Тест 25: setModelForChat устанавливает модель по ID
    runner.addTest('Session: setModelForChat устанавливает модель по ID', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString(), model: 'model-1' },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString(), model: 'model-2' }
        ];
        
        const result = sm.setModelForChat('new-model', 2);
        
        if (!result) {
            throw new Error('setModelForChat failed');
        }
        if (sm.sessions[1].model !== 'new-model') {
            throw new Error(`Expected "new-model", got "${sm.sessions[1].model}"`);
        }
    });

    // Тест 26: compressSession сжимает длинную сессию
    runner.addTest('Session: compressSession сжимает длинную сессию', () => {
        const sm = new SessionManager();
        const messages = [{ role: 'system', content: 'System' }];
        
        // Добавляем много сообщений
        for (let i = 0; i < 100; i++) {
            messages.push({ role: 'user', content: `Message ${i}` });
        }
        
        const session = {
            id: 1,
            messages: messages,
            name: 'Chat 1',
            created: new Date().toISOString()
        };
        
        sm.compressSession(session);
        
        // Проверяем, что количество сообщений уменьшилось
        if (session.messages.length >= 100) {
            throw new Error('Session should be compressed');
        }
        
        // Проверяем наличие системных сообщений
        const systemMessages = session.messages.filter(m => m.role === 'system');
        if (systemMessages.length === 0) {
            throw new Error('System messages should be preserved');
        }
    });

    // Тест 27: compressSession не сжимает короткую сессию
    runner.addTest('Session: compressSession не сжимает короткую сессию', () => {
        const sm = new SessionManager();
        const messages = [{ role: 'system', content: 'System' }];
        
        // Добавляем немного сообщений
        for (let i = 0; i < 10; i++) {
            messages.push({ role: 'user', content: `Message ${i}` });
        }
        
        const session = {
            id: 1,
            messages: messages,
            name: 'Chat 1',
            created: new Date().toISOString()
        };
        
        const originalLength = session.messages.length;
        sm.compressSession(session);
        
        // Длина не должна измениться
        if (session.messages.length !== originalLength) {
            throw new Error('Short session should not be compressed');
        }
    });

    // Тест 28: getAllSessions возвращает все сессии
    runner.addTest('Session: getAllSessions возвращает все сессии', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { id: 1, messages: [], name: 'Chat 1', created: new Date().toISOString() },
            { id: 2, messages: [], name: 'Chat 2', created: new Date().toISOString() }
        ];
        
        const all = sm.getAllSessions();
        
        if (all.length !== 2) {
            throw new Error(`Expected 2 sessions, got ${all.length}`);
        }
        // Проверяем, что это копия, а не ссылка
        if (all === sm.sessions) {
            throw new Error('Should return a copy of sessions array');
        }
    });

    // Тест 29: getMessageCount возвращает количество сообщений
    runner.addTest('Session: getMessageCount возвращает количество сообщений', () => {
        const sm = new SessionManager();
        sm.sessions = [
            { 
                id: 1, 
                messages: [],
                name: 'Chat 1',
                created: new Date().toISOString(),
                messageCount: 42
            }
        ];
        sm.currentId = 1;
        
        const count = sm.getMessageCount();
        
        if (count !== 42) {
            throw new Error(`Expected 42, got ${count}`);
        }
    });

    // Тест 30: getMessageCount возвращает 0 при отсутствии сессии
    runner.addTest('Session: getMessageCount возвращает 0 при отсутствии сессии', () => {
        const sm = new SessionManager();
        sm.sessions = [];
        
        const count = sm.getMessageCount();
        
        if (count !== 0) {
            throw new Error(`Expected 0, got ${count}`);
        }
    });
}

// Экспорт для использования в основном тест-раннере
export default runSessionManagerTests;