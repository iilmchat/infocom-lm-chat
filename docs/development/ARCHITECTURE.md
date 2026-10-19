<!-- Добавлено в 6.2: ARCHITECTURE.md (Фаза 4) -->
# Архитектура Infocom LM Chat Pro

> Краткий обзор клиентской архитектуры v6.2. Детали — в коде `src/` и
> `docs/KNOWN_ISSUES.md`. Документ не дублирует PROMPT_CURRENT.

## 1. Обзор
Клиент — SPA на vanilla JS и ES-модулях, без сборщика. Точка входа —
`index.html`, который загружает `src/app.js` (`class App`). Приложение
работает с тремя внешними сервисами:

- LM Studio — `http://127.0.0.1:8034` (генерация, модели, embeddings);
- .NET Core API — `http://127.0.0.1:8032` (комнаты, приватные чаты, админка);
- статика/IIS — `http://localhost:8033` (раздача SPA).

## 2. Ядро
**EventBus** (`src/core/event-bus.js`) — pub/sub для слабосвязанной
коммуникации. Модули не вызывают друг друга напрямую, а публикуют события:
`session:switched`, `rag:updated`, `notifications:updated`, `users:updated`
и т.п.

**Router** (`src/core/router.js`) — SPA-роутер на History API. Маршруты:
`/`, `/private`, `/admin`, `/games`, `/profile`, `/settings`, `/stats`.
Перехватывает клики по `[data-link]`, поддерживает `beforeNavigate`/
`afterNavigate` и параметры `:id`.

**ErrorBoundary** и **Storage** (`src/core/`) — глобальный перехват ошибок
и обёртка над `localStorage`.

## 3. Паттерн: App → Modules

`App` (`src/app.js`) — координатор. В конструкторе создаёт EventBus,
сервисы, менеджеры, глобальный `Sidebar` и роутер. `App._showView(viewId)`
(`src/app.js:1869`) — единая точка переключения семи контейнеров `#app-*`.

Модули (`src/modules/`):

| Модуль | Файл | Ответственность |
|---|---|---|
| Chat | `chat/ChatModule.js` | только `ChatView` |
| Private | `private/PrivateChatModule.js` | приватные чаты, упоминания |
| Admin | `admin/AdminModule.js` | админ-панель |
| Games | `games/GamesModule.js` | игры |
| Profile | `profile/ProfileModule.js` | страница профиля |
| Settings | `settings/SettingsModule.js` | настройки сервера |
| Stats | `stats/StatsModule.js` | статистика и графики |

Модуль загружается через `import()` в соответствующем `show*()` методе
`App`. `Sidebar` создаётся только в `App`; `ChatModule` не создаёт его.

## 4. Данные
Менеджеры (`src/models/`) хранят состояние в памяти и синхронизируют
нужное в `localStorage`:

- `SessionManager` — сессии чата, `chat_sessions_v5`;
- `MultiUserManager` — комнаты, пиры, приватные чаты;
- `RAGManager` / `EmbeddingCache` — документы и эмбеддинги;
- `NotificationManager` — уведомления и бейджи;
- `AssistantManager`, `AchievementManager`, `WorkspaceManager`,
  `FileManager`, `ReactionManager`, `RateLimiter`, `InputHistory`,
  `RoadmapTracker`.

Ключи `localStorage`: `chat_sessions_v5`, `chat_theme`, `app_language`,
`sidebar_width`, `server_config`, `user_profile`.

## 5. Сеть
- `ApiService` (`src/services/api-service.js`) — LM Studio:
  `/v1/models`, `/v1/chat/completions`, `/v1/embeddings`, health-check,
  стриминг и отмена запросов.
- `ChatApiClient` / `http-client.js` — .NET Core API: комнаты, приватные
  чаты, пользователи, реакции, уведомления, админка, аналитика.
- `LongPollingClient` — long polling для общих комнат.
- `AuthService` — сессия, вход/выход, восстановление пользователя.

## 6. UI

- `Sidebar` (`src/ui/views/sidebar.js`) — глобальная навигация, список
  чатов/комнат, ресайз ширины.
- `ChatView` (`src/ui/views/chat-view.js`) — сообщения, ввод, стриминг.
- `Modal`, `Toast`, `DropZone`, `FileUploader` — компоненты
  (`src/ui/components/`).
- `MessageRenderer`, `MarkdownService` — рендеринг Markdown и кода.
- Темы: `dark` (`:root` в `main.css`), `light` и `monokai` (`themes.css`).

## 7. Поток запроса

1. Пользователь отправляет сообщение в `ChatView`.
2. `App`/`ChatView` вызывает `ApiService` и добавляет сообщение в сессию.
3. Ответ стримится в DOM; Markdown рендерится через `markdownService`.
4. `SessionManager` сохраняет сессию; `EventBus` уведомляет подписчиков.
5. Для RAG `RAGManager` ищет чанки и добавляет контекст в запрос.

## 8. Ограничения

- Нет сборщика и типизации; контракты держатся на договорённостях.
- Часть менеджеров использует PascalCase/camelCase поля API без единой
  нормализации (KI-005).
- `StatsModule` пока рисует заглушки (KI-006).
- Нет graceful degradation без бэкенда `8032` (KI-025).
