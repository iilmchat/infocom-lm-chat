// src/models/reaction-manager.js
export class ReactionManager {
    constructor(app) {
        this.app = app;
        this.reactions = new Map(); // messageId -> { reactions: {emoji: count}, userReaction: emoji }
    }

    async addReaction(messageId, emoji) {
        try {
            const result = await this.app.apiService.addReaction({
                messageId,
                userId: this.app.multiUserManager.localUser.Id,
                reaction: emoji
            });
            if (result.success) {
                this.updateLocalReactions(messageId, result.reactions, result.userReaction);
                this.app.eventBus.emit('reaction:updated', { messageId, reactions: result.reactions });
                return true;
            }
        } catch (error) {
            console.error('Ошибка добавления реакции:', error);
        }
        return false;
    }

    async removeReaction(messageId) {
        try {
            const result = await this.app.apiService.removeReaction({
                messageId,
                userId: this.app.multiUserManager.localUser.Id
            });
            if (result.success) {
                this.updateLocalReactions(messageId, result.reactions, null);
                this.app.eventBus.emit('reaction:updated', { messageId, reactions: result.reactions });
                return true;
            }
        } catch (error) {
            console.error('Ошибка удаления реакции:', error);
        }
        return false;
    }

    updateLocalReactions(messageId, reactions, userReaction) {
        this.reactions.set(messageId, { reactions, userReaction });
    }

    getReactions(messageId) {
        return this.reactions.get(messageId) || { reactions: {}, userReaction: null };
    }
}