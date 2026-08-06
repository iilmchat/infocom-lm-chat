// tests/rag-manager.test.js
import { RAGManager } from '../src/models/rag-manager.js';
import { CONFIG } from '../src/config.js';

/**
 * Тесты для RAGManager
 * Запускаются через TestRunner
 */
export function runRAGManagerTests(runner) {
    // Тест 1: splitIntoChunks разбивает текст на чанки
    runner.addTest('RAG: splitIntoChunks разбивает текст', () => {
        const rag = new RAGManager();
        const text = 'Hello world. This is a test. Another sentence here. And one more for good measure.';
        const chunks = rag.splitIntoChunks(text, 30);
        
        if (chunks.length < 3) {
            throw new Error(`Expected at least 3 chunks, got ${chunks.length}`);
        }
        
        // Проверяем, что каждый чанк не пустой
        chunks.forEach(chunk => {
            if (!chunk || chunk.length === 0) {
                throw new Error('Empty chunk found');
            }
        });
    });

    // Тест 2: splitIntoChunks не создает чанки из пустого текста
    runner.addTest('RAG: пустой текст не создает чанки', () => {
        const rag = new RAGManager();
        const chunks = rag.splitIntoChunks('', 100);
        
        if (chunks.length !== 0) {
            throw new Error(`Expected 0 chunks for empty text, got ${chunks.length}`);
        }
    });

    // Тест 3: splitIntoChunks игнорирует очень короткие предложения
    runner.addTest('RAG: игнорирует короткие предложения', () => {
        const rag = new RAGManager();
        const text = 'A. B. C. D. E. F. Hello world. This is a test.';
        const chunks = rag.splitIntoChunks(text, 50);
        
        // Должен быть только один чанк с нормальными предложениями
        if (chunks.length !== 1) {
            throw new Error(`Expected 1 chunk, got ${chunks.length}`);
        }
        
        // Чанк должен содержать "Hello world"
        if (!chunks[0].includes('Hello world')) {
            throw new Error('Chunk does not contain expected text');
        }
    });

    // Тест 4: isFull возвращает true при достижении лимита
    runner.addTest('RAG: isFull возвращает true при лимите', () => {
        const rag = new RAGManager();
        rag.maxChunks = 3;
        rag.chunks = ['a', 'b', 'c'];
        
        if (!rag.isFull) {
            throw new Error('Expected isFull to be true with 3 chunks');
        }
    });

    // Тест 5: isFull возвращает false при незаполненном хранилище
    runner.addTest('RAG: isFull возвращает false при незаполненном хранилище', () => {
        const rag = new RAGManager();
        rag.maxChunks = 5;
        rag.chunks = ['a', 'b', 'c'];
        
        if (rag.isFull) {
            throw new Error('Expected isFull to be false with 3/5 chunks');
        }
    });

    // Тест 6: clear очищает все данные
    runner.addTest('RAG: clear очищает все данные', () => {
        const rag = new RAGManager();
        rag.chunks = ['a', 'b', 'c'];
        rag.embeddings = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
        rag.fileNames = ['test1.txt', 'test2.txt', 'test3.txt'];
        rag.isReady = true;
        
        rag.clear();
        
        if (rag.chunkCount !== 0) {
            throw new Error(`Expected 0 chunks after clear, got ${rag.chunkCount}`);
        }
        if (rag.embeddings.length !== 0) {
            throw new Error(`Expected 0 embeddings after clear, got ${rag.embeddings.length}`);
        }
        if (rag.fileNames.length !== 0) {
            throw new Error(`Expected 0 fileNames after clear, got ${rag.fileNames.length}`);
        }
        if (rag.isReady) {
            throw new Error('Expected isReady to be false after clear');
        }
    });

    // Тест 7: usagePercent вычисляется корректно
    runner.addTest('RAG: usagePercent вычисляется корректно', () => {
        const rag = new RAGManager();
        rag.maxChunks = 10;
        rag.chunks = ['a', 'b', 'c', 'd', 'e'];
        
        if (rag.usagePercent !== 50) {
            throw new Error(`Expected 50%, got ${rag.usagePercent}%`);
        }
    });

    // Тест 8: usagePercent возвращает 0 для пустого хранилища
    runner.addTest('RAG: usagePercent возвращает 0 для пустого хранилища', () => {
        const rag = new RAGManager();
        rag.maxChunks = 10;
        rag.chunks = [];
        
        if (rag.usagePercent !== 0) {
            throw new Error(`Expected 0%, got ${rag.usagePercent}%`);
        }
    });

    // Тест 9: usagePercent возвращает 100 для полного хранилища
    runner.addTest('RAG: usagePercent возвращает 100 для полного хранилища', () => {
        const rag = new RAGManager();
        rag.maxChunks = 5;
        rag.chunks = ['a', 'b', 'c', 'd', 'e'];
        
        if (rag.usagePercent !== 100) {
            throw new Error(`Expected 100%, got ${rag.usagePercent}%`);
        }
    });

    // Тест 10: getFileNames возвращает уникальные имена файлов
    runner.addTest('RAG: getFileNames возвращает уникальные имена', () => {
        const rag = new RAGManager();
        rag.fileNames = ['test.txt', 'test.txt', 'test2.txt', 'test2.txt', 'test3.txt'];
        
        const names = rag.getFileNames();
        
        if (names.length !== 3) {
            throw new Error(`Expected 3 unique names, got ${names.length}`);
        }
        if (!names.includes('test.txt')) {
            throw new Error('Expected "test.txt" in names');
        }
        if (!names.includes('test2.txt')) {
            throw new Error('Expected "test2.txt" in names');
        }
        if (!names.includes('test3.txt')) {
            throw new Error('Expected "test3.txt" in names');
        }
    });

    // Тест 11: getStats возвращает корректную статистику
    runner.addTest('RAG: getStats возвращает корректную статистику', () => {
        const rag = new RAGManager();
        rag.maxChunks = 10;
        rag.chunks = ['a', 'b', 'c'];
        rag.fileNames = ['test.txt', 'test.txt', 'test2.txt'];
        
        const stats = rag.getStats();
        
        if (stats.chunks !== 3) {
            throw new Error(`Expected 3 chunks, got ${stats.chunks}`);
        }
        if (stats.maxChunks !== 10) {
            throw new Error(`Expected 10 maxChunks, got ${stats.maxChunks}`);
        }
        if (stats.files !== 2) {
            throw new Error(`Expected 2 files, got ${stats.files}`);
        }
    });

    // Тест 12: toJSON и fromJSON корректно сериализуют и десериализуют
    runner.addTest('RAG: toJSON/fromJSON корректно работают', () => {
        const rag1 = new RAGManager();
        rag1.chunks = ['chunk1', 'chunk2'];
        rag1.embeddings = [[1, 2], [3, 4]];
        rag1.fileNames = ['file1.txt', 'file2.txt'];
        rag1.isReady = true;
        
        const json = rag1.toJSON();
        
        const rag2 = new RAGManager();
        rag2.fromJSON(json);
        
        if (rag2.chunks.length !== 2) {
            throw new Error(`Expected 2 chunks, got ${rag2.chunks.length}`);
        }
        if (rag2.embeddings.length !== 2) {
            throw new Error(`Expected 2 embeddings, got ${rag2.embeddings.length}`);
        }
        if (rag2.fileNames.length !== 2) {
            throw new Error(`Expected 2 fileNames, got ${rag2.fileNames.length}`);
        }
        if (!rag2.isReady) {
            throw new Error('Expected isReady to be true');
        }
        if (rag2.chunks[0] !== 'chunk1') {
            throw new Error('Chunk content mismatch');
        }
        if (rag2.fileNames[0] !== 'file1.txt') {
            throw new Error('FileName mismatch');
        }
    });

    // Тест 13: fromJSON обрабатывает превышение лимита
    runner.addTest('RAG: fromJSON обрезает при превышении лимита', () => {
        const rag = new RAGManager();
        rag.maxChunks = 2;
        
        const data = {
            chunks: ['a', 'b', 'c'],
            embeddings: [[1], [2], [3]],
            fileNames: ['f1', 'f2', 'f3'],
            isReady: true
        };
        
        rag.fromJSON(data);
        
        if (rag.chunks.length !== 2) {
            throw new Error(`Expected 2 chunks after trimming, got ${rag.chunks.length}`);
        }
        if (rag.embeddings.length !== 2) {
            throw new Error(`Expected 2 embeddings after trimming, got ${rag.embeddings.length}`);
        }
        if (rag.fileNames.length !== 2) {
            throw new Error(`Expected 2 fileNames after trimming, got ${rag.fileNames.length}`);
        }
    });

    // Тест 14: tokenize корректно разбивает текст на токены
    runner.addTest('RAG: tokenize корректно разбивает текст', () => {
        const rag = new RAGManager();
        const text = 'Hello world! This is a test.';
        const tokens = rag.tokenize(text);
        
        if (tokens.length < 4) {
            throw new Error(`Expected at least 4 tokens, got ${tokens.length}`);
        }
        if (!tokens.includes('hello')) {
            throw new Error('Expected "hello" in tokens');
        }
        if (!tokens.includes('world')) {
            throw new Error('Expected "world" in tokens');
        }
        if (!tokens.includes('test')) {
            throw new Error('Expected "test" in tokens');
        }
    });

    // Тест 15: tokenize удаляет короткие слова
    runner.addTest('RAG: tokenize удаляет короткие слова', () => {
        const rag = new RAGManager();
        const text = 'a b c hello world test';
        const tokens = rag.tokenize(text);
        
        // Должны остаться только hello, world, test
        if (tokens.length !== 3) {
            throw new Error(`Expected 3 tokens, got ${tokens.length}`);
        }
        if (tokens.includes('a') || tokens.includes('b') || tokens.includes('c')) {
            throw new Error('Short words should be filtered out');
        }
        if (!tokens.includes('hello')) {
            throw new Error('Expected "hello" in tokens');
        }
    });

    // Тест 16: cosineSimilarity вычисляет схожесть между векторами
    runner.addTest('RAG: cosineSimilarity вычисляет схожесть', () => {
        const rag = new RAGManager();
        const vec1 = new Map([['hello', 1], ['world', 1]]);
        const vec2 = new Map([['hello', 1], ['world', 1]]);
        const vec3 = new Map([['goodbye', 1], ['world', 1]]);
        
        const sim1 = rag.cosineSimilarity(vec1, vec2);
        const sim2 = rag.cosineSimilarity(vec1, vec3);
        
        if (sim1 < 0.99) {
            throw new Error(`Expected similarity ~1, got ${sim1}`);
        }
        if (sim2 > 0.7) {
            throw new Error(`Expected similarity < 0.7, got ${sim2}`);
        }
    });

    // Тест 17: cosineSimilarity возвращает 0 для пустых векторов
    runner.addTest('RAG: cosineSimilarity возвращает 0 для пустых векторов', () => {
        const rag = new RAGManager();
        const vec1 = new Map();
        const vec2 = new Map([['hello', 1]]);
        
        const sim = rag.cosineSimilarity(vec1, vec2);
        
        if (sim !== 0) {
            throw new Error(`Expected 0, got ${sim}`);
        }
    });

    // Тест 18: buildIndex создает индекс для поиска
    runner.addTest('RAG: buildIndex создает индекс', () => {
        const rag = new RAGManager();
        rag.chunks = ['Hello world', 'Test document', 'Another text'];
        rag.embeddings = [
            Array(768).fill(0).map((_, i) => (i / 768)),
            Array(768).fill(0).map((_, i) => (i / 768 + 0.1)),
            Array(768).fill(0).map((_, i) => (i / 768 - 0.1))
        ];
        
        rag.buildIndex();
        
        if (!rag._indexBuilt) {
            throw new Error('Index should be built');
        }
        if (!rag._index) {
            throw new Error('Index should not be null');
        }
        if (rag._index.length !== 3) {
            throw new Error(`Expected 3 items in index, got ${rag._index.length}`);
        }
    });
}

// Экспорт для использования в основном тест-раннере
export default runRAGManagerTests;