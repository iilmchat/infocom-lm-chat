// src/models/achievement-manager.js

/**
 * Управление достижениями пользователя
 */
export class AchievementManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.achievements = {
            first_message: { id: 'first_message', name: '💬 Первое сообщение', desc: 'Отправьте первое сообщение', unlocked: false },
            first_rag: { id: 'first_rag', name: '📚 Первый RAG', desc: 'Загрузите первый документ в RAG', unlocked: false },
            first_review: { id: 'first_review', name: '🔍 Первый Code Review', desc: 'Выполните первый Code Review', unlocked: false },
            first_test: { id: 'first_test', name: '🧪 Первые тесты', desc: 'Сгенерируйте первые тесты', unlocked: false },
            first_edit: { id: 'first_edit', name: '✏️ Первое редактирование', desc: 'Отредактируйте сообщение', unlocked: false },
            first_regenerate: { id: 'first_regenerate', name: '↻ Первая перегенерация', desc: 'Перегенерируйте ответ', unlocked: false },
            first_reply: { id: 'first_reply', name: '💬 Первый ответ', desc: 'Ответьте на сообщение', unlocked: false },
            message_10: { id: 'message_10', name: '📝 10 сообщений', desc: 'Отправьте 10 сообщений', unlocked: false },
            message_50: { id: 'message_50', name: '📝 50 сообщений', desc: 'Отправьте 50 сообщений', unlocked: false },
            message_100: { id: 'message_100', name: '📝 100 сообщений', desc: 'Отправьте 100 сообщений', unlocked: false },
            message_500: { id: 'message_500', name: '📝 500 сообщений', desc: 'Отправьте 500 сообщений', unlocked: false },
            rag_10: { id: 'rag_10', name: '📚 10 RAG чанков', desc: 'Загрузите 10 чанков в RAG', unlocked: false },
            rag_50: { id: 'rag_50', name: '📚 50 RAG чанков', desc: 'Загрузите 50 чанков в RAG', unlocked: false },
            rag_100: { id: 'rag_100', name: '📚 100 RAG чанков', desc: 'Загрузите 100 чанков в RAG', unlocked: false },
            rag_250: { id: 'rag_250', name: '📚 250 RAG чанков', desc: 'Загрузите 250 чанков в RAG', unlocked: false },
            assistant_first: { id: 'assistant_first', name: '🤖 Первый ассистент', desc: 'Активируйте ассистента', unlocked: false },
            share_first: { id: 'share_first', name: '🔗 Первый share', desc: 'Поделитесь чатом', unlocked: false },
            custom_assistant: { id: 'custom_assistant', name: '🔧 Свой ассистент', desc: 'Создайте кастомного ассистента', unlocked: false },
            tests_passed: { id: 'tests_passed', name: '🧪 Все тесты пройдены', desc: 'Пройти все unit-тесты', unlocked: false },
            edit_10: { id: 'edit_10', name: '✏️ 10 редактирований', desc: 'Отредактируйте 10 сообщений', unlocked: false },
            regenerate_10: { id: 'regenerate_10', name: '↻ 10 перегенераций', desc: 'Перегенерируйте 10 ответов', unlocked: false },
            review_10: { id: 'review_10', name: '🔍 10 Code Review', desc: 'Выполните 10 Code Review', unlocked: false },
            test_10: { id: 'test_10', name: '🧪 10 генераций тестов', desc: 'Сгенерируйте 10 тестов', unlocked: false },
            chat_master: { id: 'chat_master', name: '👑 Мастер чата', desc: 'Разблокируйте все достижения', unlocked: false }
        };
        this.messageCount = 0;
        this.ragChunkCount = 0;
        this.editCount = 0;
        this.regenerateCount = 0;
        this.reviewCount = 0;
        this.testCount = 0;
        this.replyCount = 0;
        this.unlockedCount = 0;
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem('achievements');
            if (data) {
                const parsed = JSON.parse(data);
                Object.keys(this.achievements).forEach(key => {
                    if (parsed[key] !== undefined) {
                        this.achievements[key].unlocked = parsed[key].unlocked || false;
                    }
                });
                this.messageCount = parsed.messageCount || 0;
                this.ragChunkCount = parsed.ragChunkCount || 0;
                this.editCount = parsed.editCount || 0;
                this.regenerateCount = parsed.regenerateCount || 0;
                this.reviewCount = parsed.reviewCount || 0;
                this.testCount = parsed.testCount || 0;
                this.replyCount = parsed.replyCount || 0;
                this.unlockedCount = Object.values(this.achievements).filter(a => a.unlocked).length;
            }
        } catch (error) {
            console.warn('Ошибка загрузки данных достижений:', error);
        }
    }

    save() {
        try {
            const data = {
                messageCount: this.messageCount,
                ragChunkCount: this.ragChunkCount,
                editCount: this.editCount,
                regenerateCount: this.regenerateCount,
                reviewCount: this.reviewCount,
                testCount: this.testCount,
                replyCount: this.replyCount
            };
            Object.keys(this.achievements).forEach(key => {
                data[key] = { unlocked: this.achievements[key].unlocked };
            });
            localStorage.setItem('achievements', JSON.stringify(data));
        } catch (error) {
            console.warn('Ошибка при сохранении достижений:', error);
        }
    }

    checkAndUnlock(id, callback) {
        const ach = this.achievements[id];
        if (!ach || ach.unlocked) return false;

        ach.unlocked = true;
        this.unlockedCount++;
        this.save();

        if (callback) {
            callback(ach);
        }

        // Проверка на получение мастер-достижения
        const allUnlocked = Object.values(this.achievements).every(a => a.unlocked);
        if (allUnlocked && !this.achievements.chat_master.unlocked) {
            this.achievements.chat_master.unlocked = true;
            this.unlockedCount++;
            this.save();
            if (callback) callback(this.achievements.chat_master);
        }

        if (this.eventBus) {
            this.eventBus.emit('achievement:unlocked', ach);
        }

        return true;
    }

    incrementMessage() {
        this.messageCount++;
        if (this.messageCount >= 500) this.checkAndUnlock('message_500');
        else if (this.messageCount >= 100) this.checkAndUnlock('message_100');
        else if (this.messageCount >= 50) this.checkAndUnlock('message_50');
        else if (this.messageCount >= 10) this.checkAndUnlock('message_10');
        this.save();
    }

    incrementRag(count) {
        this.ragChunkCount += count;
        if (this.ragChunkCount >= 250) this.checkAndUnlock('rag_250');
        else if (this.ragChunkCount >= 100) this.checkAndUnlock('rag_100');
        else if (this.ragChunkCount >= 50) this.checkAndUnlock('rag_50');
        else if (this.ragChunkCount >= 10) this.checkAndUnlock('rag_10');
        this.save();
    }

    incrementEdit() {
        this.editCount++;
        if (this.editCount >= 10) this.checkAndUnlock('edit_10');
        this.save();
    }

    incrementRegenerate() {
        this.regenerateCount++;
        if (this.regenerateCount >= 10) this.checkAndUnlock('regenerate_10');
        this.save();
    }

    incrementReview() {
        this.reviewCount++;
        if (this.reviewCount >= 10) this.checkAndUnlock('review_10');
        this.save();
    }

    incrementTest() {
        this.testCount++;
        if (this.testCount >= 10) this.checkAndUnlock('test_10');
        this.save();
    }

    incrementReply() {
        this.replyCount++;
        this.checkAndUnlock('first_reply');
        this.save();
    }

    getUnlocked() {
        return Object.values(this.achievements).filter(a => a.unlocked);
    }

    getLocked() {
        return Object.values(this.achievements).filter(a => !a.unlocked);
    }

    getAll() {
        return Object.values(this.achievements);
    }
}