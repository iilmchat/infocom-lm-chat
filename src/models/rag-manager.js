// src/models/rag-manager.js
import { CONFIG } from '../config.js';
import { EmbeddingCache } from './embedding-cache.js';

/**
 * Управление RAG документами и поиском
 */
export class RAGManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.chunks = [];
        this.embeddings = [];
        this.fileNames = [];
        this.isReady = false;
        this.cache = new EmbeddingCache();
        this._pendingEmbeddings = new Map();
        this.maxChunks = CONFIG.RAG.MAX_CHUNKS;
        this._index = null;
        this._indexBuilt = false;
        this.tfidfIndex = new Map();
        this.documentVectors = [];
        this.totalChunks = 0;
        this.chunkSize = CONFIG.RAG.CHUNK_SIZE;
        this.similarityThreshold = CONFIG.RAG.MIN_SIMILARITY;
    }

    get chunkCount() {
        return this.chunks.length;
    }

    get isFull() {
        return this.chunkCount >= this.maxChunks;
    }

    get usagePercent() {
        return (this.chunkCount / this.maxChunks) * 100;
    }

    splitIntoChunks(text, size = CONFIG.RAG.CHUNK_SIZE) {
        const chunkSize = size || this.chunkSize;
        const chunks = [];
        const sentences = text.split(/[.!?]+/);
        let currentChunk = '';

        for (const sentence of sentences) {
            if (sentence.length < 5) continue;

            if (currentChunk.length + sentence.length > chunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += sentence + '. ';
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    async getEmbedding(text) {
        const hash = this._hash(text);
        const cached = await this.cache.get(hash);
        if (cached) {
            return cached;
        }

        if (this._pendingEmbeddings.has(hash)) {
            return this._pendingEmbeddings.get(hash);
        }

        const promise = (async () => {
            try {
                const response = await fetch(
                    `${this.getBaseUrl()}${this.getEmbeddingsEndpoint()}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: CONFIG.RAG.EMBEDDING_MODEL,
                            input: text
                        })
                    }
                );

                if (!response.ok) {
                    throw new Error('Ошибка получения эмбеддинга');
                }

                const data = await response.json();
                const embedding = data.data[0].embedding;
                await this.cache.set(hash, embedding);
                return embedding;
            } catch (error) {
                console.warn('Используется fallback-эмбеддинг из-за ошибки:', error);
                return Array(768).fill(0).map(() => Math.random() - 0.5);
            } finally {
                this._pendingEmbeddings.delete(hash);
            }
        })();

        this._pendingEmbeddings.set(hash, promise);
        return promise;
    }

    getBaseUrl() {
        // Получаем URL из глобальной конфигурации
        const config = window.__CONFIG__ || CONFIG;
        return `http://${config.SERVER.DEFAULT_LM_IP}:${config.SERVER.LM_PORT}`;
    }

    getEmbeddingsEndpoint() {
        return CONFIG.SERVER.EMBEDDINGS_ENDPOINT || '/v1/embeddings';
    }

    _hash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + charCode;
            hash = hash & hash;
        }
        return 'emb_' + hash.toString(16);
    }

    cosine(a, b) {
        let dot = 0;
        let na = 0;
        let nb = 0;

        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }

        const magnitudeA = Math.sqrt(na);
        const magnitudeB = Math.sqrt(nb);
        return dot / (magnitudeA * magnitudeB || 1);
    }

    _buildIndex() {
        if (this.embeddings.length === 0) {
            this._indexBuilt = false;
            this._index = null;
            return;
        }

        this._index = this.embeddings.map((embedding, index) => {
            const norm = Math.sqrt(
                embedding.reduce((sum, value) => sum + value * value, 0)
            );
            const normalizedVector = embedding.map(value => value / norm);
            return {
                normalized: normalizedVector,
                index: index
            };
        });

        this._indexBuilt = true;
    }

    buildIndex() {
        if (this.chunks.length === 0) {
            this._indexBuilt = false;
            this._index = null;
            return;
        }        
        this.tfidfIndex.clear();
        this.documentVectors = [];
        const docFreq = new Map();
        const termDocs = new Map();

        this.chunks.forEach((chunk, idx) => {
            const terms = this.tokenize(chunk);
            const uniqueTerms = new Set(terms);
            uniqueTerms.forEach(term => {
                if (!termDocs.has(term)) {
                    termDocs.set(term, new Set());
                }
                termDocs.get(term).add(idx);
            });
        });

        const N = this.chunks.length;
        termDocs.forEach((docs, term) => {
            docFreq.set(term, Math.log(N / docs.size));
        });

        this.chunks.forEach((chunk, idx) => {
            const terms = this.tokenize(chunk);
            const tf = new Map();
            terms.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));

            const vector = new Map();
            tf.forEach((count, term) => {
                const idf = docFreq.get(term) || 0;
                vector.set(term, (count / terms.length) * idf);
            });
            this._index = vector;
            this.documentVectors.push(vector);
        });

        this.totalChunks = this.chunks.length;
        // Отмечаем, что индекс успешно построен
        this._indexBuilt = true;           
    }

    tokenize(text) {
        const lowerText = text.toLowerCase();
        const normalizedText = lowerText.replace(/[^a-zа-яё0-9]/g, ' ');
        const wordsArray = normalizedText.split(/\s+/);
        return wordsArray.filter(word => word.length > 2);
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        const allKeys = new Set([...vecA.keys(), ...vecB.keys()]);
        for (const key of allKeys) {
            const valueA = vecA.get(key) || 0;
            const valueB = vecB.get(key) || 0;
            dotProduct += valueA * valueB;
            normA += valueA * valueA;
            normB += valueB * valueB;
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async addDocuments(files) {
        const results = [];
        let addedCount = 0;
        const maxAdd = this.maxChunks - this.chunkCount;

        for (const file of files) {
            if (this.chunks.length >= this.maxChunks) {
                if (this.eventBus) {
                    this.eventBus.emit('toast:warning', `Достигнут лимит чанков (${this.maxChunks}). Пропускаем "${file.name}"`);
                }
                continue;
            }

            if (this.isFull) break;

            const chunks = this.splitIntoChunks(file.content);
            let added = 0;

            for (const chunk of chunks) {
                if (this.isFull || addedCount >= maxAdd) break;

                const emb = await this.getEmbedding(chunk);
                this.chunks.push(chunk);
                this.embeddings.push(emb);
                this.fileNames.push(file.name);

                results.push({ chunk, source: file.name });
                added++;
                addedCount++;
            }

            if (added < chunks.length) {
                if (this.eventBus) {
                    this.eventBus.emit('toast:warning', `"${file.name}" обрезан: добавлено ${added} из ${chunks.length} чанков (лимит)`);
                }
            }
        }

        this.isReady = this.chunkCount > 0;
        if (this.isReady) {
            this.buildIndex();
        }

        if (this.eventBus) {
            this.eventBus.emit('rag:updated', { count: this.chunkCount });
        }

        return results;
    }

    async findRelevant(query, topK = CONFIG.RAG.TOP_K) {
        const maxCI = topK || CONFIG.RAG.TOP_K;
        if (!this.isReady || this.embeddings.length === 0) return [];

        const queryEmbedding = await this.getEmbedding(query);
        const similarities = this.embeddings.map((embedding, index) => ({
            index: index,
            similarity: this.cosine(queryEmbedding, embedding)
        }));

        similarities.sort((a, b) => b.similarity - a.similarity);

        const relevantResults = similarities
            .slice(0, maxCI)
            .filter(item => item.similarity >= CONFIG.RAG.MIN_SIMILARITY)
            .map(item => ({
                chunk: this.chunks[item.index],
                source: this.fileNames[item.index] || 'unknown',
                similarity: item.similarity
            }));

        return relevantResults;
    }

    async getContext(query) {
        const relevantDocuments = await this.findRelevant(query);
        if (!relevantDocuments.length) {
            return null;
        }

        let contextText = '📚 Контекст из документов:\n\n';
        relevantDocuments.forEach((document, index) => {
            const cleanSource = this.sanitizeHTML(document.source);
            const similarityPercentage = (document.similarity * 100).toFixed(1);
            contextText += `Источник ${index + 1} (${cleanSource}, рел.: ${similarityPercentage}%):\n${document.chunk}\n\n`;
        });

        return {
            text: contextText,
            sources: relevantDocuments
        };
    }

    getFileNames() {
        return [...new Set(this.fileNames)];
    }

    getStats() {
        return {
            chunks: this.chunks.length,
            maxChunks: this.maxChunks,
            files: this.getFileNames().length
        };
    }

    clear() {
        this.chunks = [];
        this.embeddings = [];
        this.fileNames = [];
        this.isReady = false;
        this.tfidfIndex.clear();
        this.documentVectors = [];
        this.totalChunks = 0;
        this._index = null;
        this._indexBuilt = false;
        this.cache.clear();
        if (this.eventBus) {
            this.eventBus.emit('rag:cleared');
        }
    }

    toJSON() {
        return {
            chunks: this.chunks,
            embeddings: this.embeddings,
            fileNames: this.fileNames,
            isReady: this.isReady
        };
    }

    fromJSON(data) {
        if (!data) return;
        this.chunks = data.chunks || [];
        this.embeddings = data.embeddings || [];
        this.fileNames = data.fileNames || [];
        this.isReady = data.isReady || false;

        if (this.chunks.length > this.maxChunks) {
            this.chunks = this.chunks.slice(0, this.maxChunks);
            this.embeddings = this.embeddings.slice(0, this.maxChunks);
            this.fileNames = this.fileNames.slice(0, this.maxChunks);
        }

        if (this.chunks.length > 0) {
            this.buildIndex();
        }
    }

    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}