╔══════════════════════════════════════════════════════════════════════════════╗
║    Infocom LM Chat Pro v5.1 — Полный справочник REST API для клиента       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Базовый URL (локальный сервер): http://localhost:8032
Все запросы и ответы — JSON. 
Обязательные заголовки: Content-Type: application/json, Accept: application/json
(если не указано иное)

Структуры данных (DTO) описаны отдельно в конце документа.

────────────────────────────────────────────────────────────────────────────────
1. БАЗОВЫЕ / СЛУЖЕБНЫЕ
────────────────────────────────────────────────────────────────────────────────
GET    /api/sync/ping
       → Ответ: { "success": true, "timestamp": "2025-…", "version": "1.0.0" }

GET    /api/admin/health
       → Ответ: { "status": "healthy", "timestamp": "…", "version": "5.1.0" }

────────────────────────────────────────────────────────────────────────────────
2. ПОЛЬЗОВАТЕЛИ (профиль, блокировка, приватные чаты)
────────────────────────────────────────────────────────────────────────────────
POST   /api/private/user
       Тело: { "userId": "string", "name": "string", "avatar": "string(эмодзи)", "color": "string(HEX)" }
       → Ответ: { "success": true, "user": UserInfoDto }

GET    /api/private/user/{userId}
       → Ответ: { "success": true, "user": UserInfoDto }

GET    /api/private/users
       → Ответ: { "success": true, "users": [UserInfoDto] }

GET    /api/private/users/online
       → Ответ: { "success": true, "users": [UserInfoDto] }

GET    /api/private/user/{userId}/unread
       → Ответ: { "success": true, "unread": number }

POST   /api/private/user/block
       Тело: { "userId": "string", "blockUserId": "string" }
       → Ответ: { "success": true }

POST   /api/private/user/unblock
       Тело: { "userId": "string", "blockUserId": "string" }
       → Ответ: { "success": true }

GET    /api/private/user/{userId}/blocked
       → Ответ: { "success": true, "blocked": ["string"] }

POST   /api/private/heartbeat
       Тело: { "userId": "string" }
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
3. ПРИВАТНЫЕ ЧАТЫ
────────────────────────────────────────────────────────────────────────────────
POST   /api/private/chat/create
       Тело: { "user1Id": "string", "user2Id": "string" }
       → Ответ: { "success": true, "chatId": "string" }

GET    /api/private/user/{userId}/chats
       → Ответ: { "success": true, "chats": [PrivateChatDto] }

POST   /api/private/message/send
       Тело: { "chatId": "string", "senderId": "string", "receiverId": "string", 
                "content": "string", "replyToId": "string(опционально)" }
       → Ответ: { "success": true, "message": PrivateMessageDto }

GET    /api/private/chat/{chatId}/history?limit=50&offset=0
       → Ответ: { "success": true, "messages": [PrivateMessageDto], "total": number }

POST   /api/private/chat/mark-read
       Тело: { "chatId": "string", "userId": "string" }
       → Ответ: { "success": true }

POST   /api/private/message/{messageId}
       Тело: { "userId": "string", "newContent": "string" }
       → Ответ: { "success": true }

DELETE /api/private/message/{messageId}?userId=...
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
4. ОБЩИЕ КОМНАТЫ
────────────────────────────────────────────────────────────────────────────────
POST   /api/room/create
       Тело: { "name": "string", "createdBy": "string" }
       → Ответ: { "success": true, "roomId": "string" }

POST   /api/room/join
       Тело: { "roomId": "string", "user": UserInfo }
       → Ответ: { "success": true, "users": [UserInfo], "history": [ChatMessage] }

POST   /api/room/leave
       Тело: { "roomId": "string", "userId": "string" }
       → Ответ: { "success": true }

GET    /api/room/list
       → Ответ: { "success": true, "rooms": [RoomInfo] }

GET    /api/room/info/{roomId}
       → Ответ: { "success": true, "room": RoomInfo }

GET    /api/room/search?query=...&limit=20
       → Ответ: { "success": true, "rooms": [RoomInfo] }

────────────────────────────────────────────────────────────────────────────────
5. СООБЩЕНИЯ В КОМНАТАХ
────────────────────────────────────────────────────────────────────────────────
POST   /api/chat/send
       Тело: { "roomId": "string", "userId": "string", "userName": "string", 
                "userAvatar": "string", "content": "string", "role": "user", 
                "replyToId": "string(опционально)", "attachments": [FileAttachment] }
       → Ответ: { "success": true, "message": ChatMessage, "mentions": ["string"] }

GET    /api/chat/history/{roomId}?limit=50&offset=0
       → Ответ: { "success": true, "messages": [ChatMessage], "total": number, "hasMore": bool }

POST   /api/chat/edit
       Тело: { "roomId": "string", "messageId": "string", "userId": "string", 
                "newContent": "string" }
       → Ответ: { "success": true, "messageId": "string", "newContent": "string" }

DELETE /api/chat/delete/{roomId}/{messageId}/{userId}
       → Ответ: { "success": true }

GET    /api/chat/last/{roomId}
       → Ответ: { "success": true, "message": ChatMessage | null, "hasMessages": bool }

GET    /api/chat/range/{roomId}?from=...&to=...&limit=100
       → Ответ: { "success": true, "messages": [ChatMessage], "count": number }

GET    /api/chat/stats/{roomId}
       → Ответ: { "success": true, "stats": MessageStats }

GET    /api/chat/after/{roomId}/{lastMessageId}
       → Ответ: { "success": true, "messages": [ChatMessage], "count": number }

GET    /api/chat/search/{roomId}?query=...&limit=50
       → Ответ: { "success": true, "results": [ChatMessage], "count": number }

DELETE /api/chat/clear/{roomId}
       → Ответ: { "success": true }

POST   /api/chat/pin/{messageId}
       Тело: { "roomId": "string", "userId": "string" }
       → Ответ: { "success": true, "pinnedAt": "datetime" }

DELETE /api/chat/pin/{messageId}?roomId=...
       → Ответ: { "success": true }

GET    /api/chat/pinned/{roomId}
       → Ответ: { "success": true, "messages": [ChatMessage] }

POST   /api/chat/report/{messageId}
       Тело: { "reporterId": "string", "reason": "string", "description": "string" }
       → Ответ: { "success": true, "reportId": "string" }

────────────────────────────────────────────────────────────────────────────────
6. РЕАКЦИИ
────────────────────────────────────────────────────────────────────────────────
POST   /api/Reaction/add
       Тело: { "messageId": "string", "userId": "string", "reaction": "string(эмодзи)" }
       → Ответ: { "success": true, "reactions": { "👍": 2, "❤️": 1 }, "userReaction": "string" }

DELETE /api/Reaction/remove?messageId=...&userId=...
       → Ответ: { "success": true, "reactions": { ... }, "userReaction": null }

GET    /api/Reaction/message/{messageId}
       → Ответ: { "success": true, "reactions": { "👍": 2, "❤️": 1 } }

GET    /api/Reaction/message/{messageId}/user/{userId}
       → Ответ: { "success": true, "userReaction": "string" }

────────────────────────────────────────────────────────────────────────────────
7. УПОМИНАНИЯ
────────────────────────────────────────────────────────────────────────────────
GET    /api/Mention/unread/{userId}
       → Ответ: { "success": true, "mentions": [MentionDto], "unreadCount": number }

POST   /api/Mention/mark-read
       Тело: { "userId": "string", "mentionIds": ["string"] }  // если пустой массив – все
       → Ответ: { "success": true, "unreadCount": number }

GET    /api/Mention/count/{userId}
       → Ответ: { "success": true, "unreadCount": number }

POST   /api/Mention/extract
       Тело: { "text": "string" }
       → Ответ: { "success": true, "mentions": ["username1", "username2"] }

────────────────────────────────────────────────────────────────────────────────
8. СИНХРОНИЗАЦИЯ (Long Polling)
────────────────────────────────────────────────────────────────────────────────
POST   /api/sync/state
       Тело: { "roomId": "string", "userId": "string", "lastSyncTime": "datetime(опционально)" }
       → Ответ: { "success": true, "state": SyncStateResponse }

POST   /api/sync/poll
       Тело: { "roomId": "string", "userId": "string", "lastMessageCount": number, 
                "timeoutSeconds": number(опционально) }
       → Ответ: { "success": true, "hasNewMessages": bool, "messages": [ChatMessage], 
                   "messageCount": number, "users": [UserInfo] }

POST   /api/sync/users
       Тело: { "roomId": "string", "userId": "string", "isTyping": bool(опционально) }
       → Ответ: { "success": true, "users": [UserStatusDto], "totalUsers": number }

GET    /api/sync/status/{roomId}
       → Ответ: { "success": true, "users": [UserInfoBrief], "messageCount": number, 
                   "onlineCount": number }

POST   /api/sync/typing
       Тело: { "roomId": "string", "userId": "string", "isTyping": bool }
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
9. АНАЛИТИКА
────────────────────────────────────────────────────────────────────────────────
GET    /api/analytics/user/{userId}/activity?from=...&to=...
       → Ответ: { "success": true, "data": UserActivityDto }

GET    /api/analytics/room/{roomId}/engagement?from=...&to=...
       → Ответ: { "success": true, "data": RoomEngagementDto }

GET    /api/analytics/global
       → Ответ: { "success": true, "data": GlobalAnalyticsDto }

────────────────────────────────────────────────────────────────────────────────
10. УВЕДОМЛЕНИЯ
────────────────────────────────────────────────────────────────────────────────
GET    /api/notifications/user/{userId}?onlyUnread=true&limit=50
       → Ответ: { "success": true, "notifications": [NotificationDto], 
                   "unreadCount": number, "total": number }

POST   /api/notifications/mark-read
       Тело: { "userId": "string", "notificationIds": ["string"] } // если пусто – все
       → Ответ: { "success": true, "unreadCount": number }

GET    /api/notifications/count/{userId}
       → Ответ: { "success": true, "unreadCount": number }

────────────────────────────────────────────────────────────────────────────────
11. ВЛОЖЕНИЯ (ФАЙЛЫ)
────────────────────────────────────────────────────────────────────────────────
POST   /api/attachment/upload
       (multipart/form-data) поле "file" и опционально "messageId"
       → Ответ: { "success": true, "attachment": AttachmentUploadResult }

GET    /api/attachment/{attachmentId}
       → Ответ: бинарный файл (с заголовком Content-Disposition)

DELETE /api/attachment/{attachmentId}
       → Ответ: { "success": true }

GET    /api/attachment/message/{messageId}
       → Ответ: { "success": true, "attachments": [Attachment] }

────────────────────────────────────────────────────────────────────────────────
12. АДМИНИСТРИРОВАНИЕ (роли, пользователи, комнаты, сообщения, логи)
────────────────────────────────────────────────────────────────────────────────

12.1. Роли и настройки
GET    /api/admin/default-role
       → Ответ: { "success": true, "defaultRole": "string" }

POST   /api/admin/default-role
       Тело: { "role": "Admin|Manager|User|Guest" }
       → Ответ: { "success": true }

GET    /api/admin/role-stats
       → Ответ: { "success": true, "stats": { "Admin": 1, "User": 10, ... } }

12.2. Пользователи (админ)
GET    /api/admin/users
       → Ответ: { "success": true, "users": [AdminUserInfo] }

GET    /api/admin/users/paginated?page=1&pageSize=10&sortBy=name&sortDescending=false&searchTerm=...
       → Ответ: { "success": true, "data": [AdminUserInfo], "pagination": { ... } }

GET    /api/admin/user/{userId}
       → Ответ: { "success": true, "user": AdminUserInfo }

GET    /api/admin/user/{userId}/isAdmin
       → Ответ: { "success": true/false }  // (boolean в поле success)

GET    /api/admin/user/{userId}/isModerator
       → Ответ: { "success": true/false }

GET    /api/admin/user/{userId}/stats
       → Ответ: { "success": true, "stats": { "userName": "...", "messageCount": 0, ... } }

GET    /api/admin/user/{userId}/blocks
       → Ответ: { "success": true, "blocked": [...] }

PUT    /api/admin/user/{userId}/profile
       Тело: { "name": "string", "avatar": "string", "color": "string" }
       → Ответ: { "success": true, "user": UserInfoDto }

POST   /api/admin/user/{userId}/role
       Тело: { "role": "Admin|Manager|User|Guest", "moderatorId": "string" }
       → Ответ: { "success": true }

POST   /api/admin/user/{userId}/mute
       Тело: { "minutes": number, "moderatorId": "string", "reason": "string" }
       → Ответ: { "success": true }

POST   /api/admin/user/{userId}/kick
       Тело: { "roomId": "string", "moderatorId": "string" }
       → Ответ: { "success": true }

POST   /api/admin/user/{userId}/ban
       Тело: { "moderatorId": "string", "reason": "string" }
       → Ответ: { "success": true }

POST   /api/admin/user/{userId}/unban
       Тело: { "moderatorId": "string" }
       → Ответ: { "success": true }

DELETE /api/admin/user/{userId}/history
       → Ответ: { "success": true }

POST   /api/admin/user/{userId}/reset-unread
       → Ответ: { "success": true }

12.3. Комнаты (админ)
GET    /api/admin/rooms
       → Ответ: { "success": true, "rooms": [AdminRoomInfo] }

GET    /api/admin/room/{roomId}
       → Ответ: { "success": true, "room": RoomInfo }

GET    /api/admin/room/{roomId}/stats
       → Ответ: { "success": true, "stats": { ... } }

DELETE /api/admin/room/{roomId}
       → Ответ: { "success": true }

DELETE /api/admin/room/{roomId}/history
       → Ответ: { "success": true }

POST   /api/admin/room/{roomId}/close
       → Ответ: { "success": true }

GET    /api/admin/room/{roomId}/export?format=json
       → Ответ: { "success": true, "data": { ... } }

PUT    /api/admin/room/{roomId}/settings
       Тело: RoomSettings (объект)
       → Ответ: { "success": true }

POST   /api/admin/room/{roomId}/transfer
       Тело: { "newOwnerId": "string" }
       → Ответ: { "success": true }

12.4. Сообщения (админ)
DELETE /api/admin/message/{messageId}
       → Ответ: { "success": true }

POST   /api/admin/message/{messageId}
       Тело: { "moderatorId": "string", "newContent": "string" }
       → Ответ: { "success": true }

POST   /api/admin/messages/search
       Тело: { "query": "string", "limit": 50 }
       → Ответ: { "success": true, "results": [ ... ] }

12.5. Логи и общая статистика
GET    /api/admin/stats
       → Ответ: { "success": true, "stats": AdminStats }

GET    /api/admin/logs?userId=...
       → Ответ: { "success": true, "logs": [ModerationLog] }

DELETE /api/admin/clear-all
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
13. СИСТЕМНЫЕ НАСТРОЙКИ (админ)
────────────────────────────────────────────────────────────────────────────────
GET    /api/admin/settings
       → Ответ: { "success": true, "settings": [SystemSettingDto] }

GET    /api/admin/settings/{key}
       → Ответ: { "success": true, "setting": SystemSettingDto }

PUT    /api/admin/settings/{key}
       Тело: { "value": "string", "description": "string(опционально)" }
       → Ответ: { "success": true }

POST   /api/admin/settings
       Тело: { "key": "string", "value": "string", "description": "string" }
       → Ответ: { "success": true }

DELETE /api/admin/settings/{key}
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
14. УПРАВЛЕНИЕ СЕССИЯМИ (аутентификация)
────────────────────────────────────────────────────────────────────────────────
GET    /api/auth/sessions?userId=...
       → Ответ: { "success": true, "sessions": [SessionDto] }

DELETE /api/auth/sessions/{sessionId}?userId=...
       → Ответ: { "success": true }

POST   /api/auth/logout-all
       Тело: { "userId": "string" }
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
15. БОТЫ (интеграция)
────────────────────────────────────────────────────────────────────────────────
POST   /api/bot/message
       Тело: { "apiKey": "string", "roomId": "string", "content": "string", 
                "replyToId": "string(опционально)" }
       → Ответ: { "success": true, "message": { ... } }

GET    /api/bot/rooms?apiKey=...
       → Ответ: { "success": true, "rooms": ["roomId1", ...] }

POST   /api/bot/join
       Тело: { "apiKey": "string", "roomId": "string" }
       → Ответ: { "success": true }

────────────────────────────────────────────────────────────────────────────────
16. ЭКСПОРТ / ИМПОРТ
────────────────────────────────────────────────────────────────────────────────
GET    /api/export/room/{roomId}/pdf
       → Ответ: (заглушка) { "success": true, "message": "..." }

GET    /api/export/user/{userId}/data
       → Ответ: JSON-файл с данными пользователя (скачивается)

POST   /api/import/room
       Тело: объект комнаты (формат импорта)
       → Ответ: { "success": true, "message": "..." }

────────────────────────────────────────────────────────────────────────────────
СТРУКТУРЫ ДАННЫХ (DTO)
────────────────────────────────────────────────────────────────────────────────

UserInfoDto:
{
  "id": "string",
  "name": "string",
  "avatar": "string",
  "color": "string",
  "isTyping": bool,
  "lastSeen": "datetime",
  "roomId": "string(опционально)",
  "role": "Admin|Manager|User|Guest",
  "status": "online|away|busy|offline|banned",
  "isOnline": bool,
  "banReason": "string(опционально)",
  "bannedAt": "datetime(опционально)",
  "mutedUntil": "datetime(опционально)",
  "roomCount": number,
  "messageCount": number,
  "unreadCount": number,
  "createdAt": "datetime"
}

UserInfo (модель для комнат):
{
  "id": "string",
  "name": "string",
  "avatar": "string",
  "color": "string",
  "isTyping": bool,
  "lastSeen": "datetime",
  "roomId": "string",
  "role": "string",
  "status": "string",
  "joinedAt": "datetime"
}

RoomInfo:
{
  "roomId": "string",
  "name": "string",
  "description": "string(опционально)",
  "createdAt": "datetime",
  "createdBy": "string",
  "users": [UserInfo],
  "messages": [ChatMessage],
  "model": "string",
  "messageCount": number,
  "lastActivity": "datetime",
  "isPrivate": bool,
  "settings": RoomSettings
}

RoomSettings:
{
  "maxHistory": number,
  "requireApproval": bool,
  "ragEnabled": bool,
  "exportEnabled": bool,
  "allowGuests": bool,
  "defaultLanguage": "string",
  "maxUsers": number,
  "lifetimeMinutes": number,
  "allowEditing": bool,
  "allowDeletion": bool,
  "codeReviewEnabled": bool,
  "testGenerationEnabled": bool
}

ChatMessage:
{
  "id": "string",
  "roomId": "string",
  "userId": "string",
  "userName": "string",
  "userAvatar": "string",
  "role": "user|assistant|system",
  "content": "string",
  "timestamp": "datetime",
  "replyToId": "string(опционально)",
  "isEdited": bool,
  "model": "string",
  "attachments": [FileAttachment],
  "metadata": {}
}

FileAttachment:
{
  "name": "string",
  "content": "string(base64)",   // только при отправке
  "size": number,
  "type": "string(MIME)"
}

PrivateChatDto:
{
  "chatId": "string",
  "user1Id": "string",
  "user2Id": "string",
  "lastMessage": "string",
  "lastMessageAt": "datetime",
  "createdAt": "datetime",
  "lastActivity": "datetime",
  "isActive": bool,
  "user1": UserPreviewDto,
  "user2": UserPreviewDto,
  "privateMessages": [PrivateMessageDto] (опционально)
}

UserPreviewDto:
{
  "userId": "string",
  "name": "string",
  "avatar": "string",
  "color": "string",
  "status": "string",
  "isOnline": bool
}

PrivateMessageDto:
{
  "messageId": "string",
  "chatId": "string",
  "senderId": "string",
  "receiverId": "string",
  "senderName": "string",
  "senderAvatar": "string",
  "content": "string",
  "timestamp": "datetime",
  "isRead": bool,
  "readAt": "datetime(опционально)",
  "replyToId": "string(опционально)",
  "isEdited": bool,
  "editedAt": "datetime(опционально)",
  "attachments": [FileAttachment]
}

AdminUserInfo (расширенный для админки):
{
  (все поля UserInfoDto) + 
  "isAdmin": bool,
  "isModerator": bool,
  "isBanned": bool
}

AdminRoomInfo:
{
  "id": "string",
  "name": "string",
  "createdAt": "datetime",
  "createdBy": "string",
  "userCount": number,
  "messageCount": number,
  "lastActivity": "datetime",
  "isActive": bool,
  "isPrivate": bool
}

AdminStats:
{
  "totalUsers": number,
  "onlineUsers": number,
  "totalRooms": number,
  "totalMessages": number,
  "privateMessages": number,
  "uptime": "datetime",
  "bannedUsers": number,
  "mutedUsers": number
}

ModerationLog:
{
  "id": "string",
  "moderatorId": "string",
  "moderatorName": "string",
  "targetUserId": "string",
  "targetUserName": "string",
  "action": "string",
  "reason": "string",
  "timestamp": "datetime",
  "durationMinutes": number
}

MessageStats:
{
  "totalMessages": number,
  "userMessages": number,
  "assistantMessages": number,
  "editedMessages": number,
  "firstMessageTime": "datetime(опционально)",
  "lastMessageTime": "datetime(опционально)"
}

MentionDto:
{
  "mentionId": "string",
  "messageId": "string",
  "userId": "string",
  "mentionedBy": "string",
  "isRead": bool,
  "createdAt": "datetime",
  "readAt": "datetime(опционально)",
  "message": ChatMessage (опционально)
}

UserActivityDto: { ... }  // см. спецификацию аналитики
RoomEngagementDto: { ... }
GlobalAnalyticsDto: { ... }

NotificationDto:
{
  "notificationId": "string",
  "type": "mention|reaction|message|system",
  "title": "string",
  "body": "string",
  "data": {},
  "isRead": bool,
  "createdAt": "datetime",
  "readAt": "datetime(опционально)"
}

Attachment (сущность):
{
  "attachmentId": "string",
  "messageId": "string",
  "fileName": "string",
  "filePath": "string",
  "fileSize": number,
  "mimeType": "string",
  "uploadedAt": "datetime"
}

AttachmentUploadResult:
{
  "attachmentId": "string",
  "fileName": "string",
  "fileSize": number,
  "mimeType": "string",
  "url": "string"
}

SystemSettingDto:
{
  "key": "string",
  "value": "string",
  "description": "string",
  "updatedAt": "string"
}

SessionDto:
{
  "sessionId": "string",
  "deviceName": "string",
  "deviceType": "string",
  "ipAddress": "string",
  "createdAt": "datetime",
  "lastActivity": "datetime",
  "isActive": bool,
  "expiresAt": "datetime"
}

BotAccountDto:
{
  "botId": "string",
  "name": "string",
  "avatar": "string",
  "apiKey": "string",
  "isActive": bool,
  "createdAt": "datetime",
  "ownerId": "string"
}

────────────────────────────────────────────────────────────────────────────────
Замечания:
- Все временные метки в UTC (ISO 8601).
- В ответах всегда присутствует поле "success": true/false.
- При ошибках возвращается HTTP 4xx/5xx с JSON: { "error": "..." }.
- Для пагинации используются параметры limit/offset или page/pageSize.
- Для Long Polling используйте таймаут до 30 секунд.
- Для загрузки файлов используйте multipart/form-data.
- Атрибуты, отмеченные как "опционально", могут отсутствовать.

────────────────────────────────────────────────────────────────────────────────
Конец документа.