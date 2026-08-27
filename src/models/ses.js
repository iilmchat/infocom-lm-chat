// Импорт необходимых типов (если используется TypeScript)
/**
 * Класс управления сессиями чата с использованием IndexedDB
 */
class IndexedDBSessionManager {
    constructor() {
        // Имя базы данных
        this.dbName = 'ChatSessionsDB';
        // Версия базы данных
        this.version = 1;
        // Имя объекта хранилища (store)
        this.storeName = 'sessions';
        // Ссылка на базу данных
        this.db = null;
    }

    /**
     * Открывает соединение с IndexedDB и создает структуру базы данных при необходимости
     */
    async openDatabase() {
        return new Promise((resolve, reject) => {
            // Создаем запрос на открытие базы данных
            const request = indexedDB.open(this.dbName, this.version);
            
            // Обработчик успешного открытия
            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB успешно открыт');
                resolve(this.db);
            };
            
            // Обработчик ошибки открытия
            request.onerror = () => {
                console.error('Ошибка при открытии IndexedDB:', request.error);
                reject(request.error);
            };
            
            // Обработчик создания/обновления структуры базы данных
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище, если оно не существует
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    
                    // Создаем индекс по дате для быстрого поиска старых сессий
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    /**
     * Сохраняет данные сессии в IndexedDB
     * @param {Object} data - Данные сессии для сохранения
     */
    async save(data) {
        try {
            // Проверяем, что база данных открыта
            if (!this.db) {
                await this.openDatabase();
            }
            
            // Создаем транзакцию на запись
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Добавляем данные в хранилище
            const request = objectStore.put(data);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('Сессия успешно сохранена в IndexedDB');
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при сохранении сессии:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при сохранении данных:', error);
            throw error;
        }
    }

    /**
     * Получает все сессии из IndexedDB
     * @returns {Array} Массив всех сессий
     */
    async getAllSessions() {
        try {
            if (!this.db) {
                await this.openDatabase();
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Получаем все записи
            const request = objectStore.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при получении сессий:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при чтении данных:', error);
            throw error;
        }
    }

    /**
     * Получает конкретную сессию по ID
     * @param {string} id - ID сессии
     * @returns {Object|null} Сессия или null, если не найдена
     */
    async getSessionById(id) {
        try {
            if (!this.db) {
                await this.openDatabase();
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Получаем запись по ключу
            const request = objectStore.get(id);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result || null);
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при получении сессии:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при чтении данных:', error);
            throw error;
        }
    }

    /**
     * Удаляет сессию по ID
     * @param {string} id - ID сессии для удаления
     */
    async deleteSession(id) {
        try {
            if (!this.db) {
                await this.openDatabase();
            }
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Удаляем запись по ключу
            const request = objectStore.delete(id);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('Сессия успешно удалена');
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при удалении сессии:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при удалении данных:', error);
            throw error;
        }
    }

    /**
     * Очищает старые сессии, оставляя только последние N
     * @param {number} maxSessions - Максимальное количество сессий для хранения
     */
    async clearOldSessions(maxSessions = 10) {
        try {
            if (!this.db) {
                await this.openDatabase();
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Получаем все записи отсортированные по дате создания
            const request = objectStore.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = async () => {
                    const sessions = request.result;
                    
                    // Сортируем по createdAt (новые первыми)
                    sessions.sort((a, b) => 
                        new Date(b.createdAt) - new Date(a.createdAt)
                    );
                    
                    // Удаляем старые сессии
                    for (let i = maxSessions; i < sessions.length; i++) {
                        await this.deleteSession(sessions[i].id);
                    }
                    
                    console.log(`Очищено ${sessions.length - maxSessions} старых сессий`);
                    resolve();
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при получении сессий для очистки:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при очистке старых сессий:', error);
            throw error;
        }
    }

    /**
     * Получает количество всех сессий
     * @returns {number} Количество сессий
     */
    async getSessionCount() {
        try {
            if (!this.db) {
                await this.openDatabase();
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            
            // Получаем количество записей
            const request = objectStore.count();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                
                request.onerror = (event) => {
                    console.error('Ошибка при подсчете сессий:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Ошибка при получении количества сессий:', error);
            throw error;
        }
    }

    /**
     * Закрывает соединение с IndexedDB
     */
    closeDatabase() {
        if (this.db) {
            this.db.close();
            console.log('Соединение с IndexedDB закрыто');
        }
    }
}

// Пример использования класса:
/*
const sessionManager = new IndexedDBSessionManager();

// Сохраняем данные
sessionManager.save({
    id: 'session-1',
    createdAt: new Date().toISOString(),
    data: {
        messages: [
            { role: 'user', content: 'Привет!' },
            { role: 'assistant', content: 'Здравствуйте!' }
        ]
    }
});

// Получаем все сессии
sessionManager.getAllSessions()
    .then(sessions => console.log('Сессии:', sessions));

// Удаляем сессию
sessionManager.deleteSession('session-1');
*/
