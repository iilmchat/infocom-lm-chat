// src/services/http-client.js - добавить новые методы

export class ChatApiClient {
    // ... существующие методы ...

    // === Private Chat API ===

    async createPrivateChat(data) {
        return this.request('/private/chat/create', {
            method: 'POST',
            body: data
        });
    }

    async sendPrivateMessage(data) {
        return this.request('/private/message/send', {
            method: 'POST',
            body: data
        });
    }

    async getPrivateHistory(chatId, limit = 50, offset = 0) {
        return this.request(`/private/chat/${chatId}/history?limit=${limit}&offset=${offset}`);
    }

    async markPrivateRead(data) {
        return this.request('/private/chat/mark-read', {
            method: 'POST',
            body: data
        });
    }

    async getUnreadCount(userId) {
        return this.request(`/private/user/${userId}/unread`);
    }

    async deletePrivateMessage(messageId, userId) {
        return this.request(`/private/message/${messageId}?userId=${userId}`, {
            method: 'DELETE'
        });
    }

    async editPrivateMessage(messageId, data) {
        return this.request(`/private/message/${messageId}`, {
            method: 'PUT',
            body: data
        });
    }

    async blockUser(data) {
        return this.request('/private/user/block', {
            method: 'POST',
            body: data
        });
    }

    async unblockUser(data) {
        return this.request('/private/user/unblock', {
            method: 'POST',
            body: data
        });
    }

    async getBlockedUsers(userId) {
        return this.request(`/private/user/${userId}/blocked`);
    }

    async heartbeat(data) {
        return this.request('/private/heartbeat', {
            method: 'POST',
            body: data
        });
    }

    async updateUserProfile(data) {
        return this.request('/private/user', {
            method: 'PUT',
            body: data
        });
    }

    // === Admin API ===

    async getAllUsers() {
        return this.request('/admin/users');
    }

    async getOnlineUsers() {
        return this.request('/admin/users/online');
    }

    async getUserStats(userId) {
        return this.request(`/admin/user/${userId}/stats`);
    }

    async muteUser(data) {
        return this.request(`/admin/user/${data.userId}/mute`, {
            method: 'POST',
            body: { minutes: data.minutes, moderatorId: data.moderatorId, reason: data.reason }
        });
    }

    async kickUser(data) {
        return this.request(`/admin/user/${data.userId}/kick`, {
            method: 'POST',
            body: { roomId: data.roomId, moderatorId: data.moderatorId }
        });
    }

    async banUser(data) {
        return this.request(`/admin/user/${data.userId}/ban`, {
            method: 'POST',
            body: { moderatorId: data.moderatorId, reason: data.reason }
        });
    }

    async unbanUser(data) {
        return this.request(`/admin/user/${data.userId}/unban`, {
            method: 'POST',
            body: { moderatorId: data.moderatorId }
        });
    }

    async clearRoomHistory(data) {
        return this.request(`/admin/room/${data.roomId}/history`, {
            method: 'DELETE'
        });
    }

    async deleteRoom(data) {
        return this.request(`/admin/room/${data.roomId}`, {
            method: 'DELETE'
        });
    }

    async getAdminStats() {
        return this.request('/admin/stats');
    }

    async getModerationLog(userId = null) {
        const query = userId ? `?userId=${userId}` : '';
        return this.request(`/admin/logs${query}`);
    }

    async searchMessages(data) {
        return this.request('/admin/messages/search', {
            method: 'POST',
            body: data
        });
    }
}