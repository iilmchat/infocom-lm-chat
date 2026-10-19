<!-- Добавлено в 6.2: PROMPT_CURRENT.md на основе audit-01-docs.md (Фаза 4) -->
# PROMPT_CURRENT.md — Infocom LM Chat Pro

> Актуальный контекст для нового чата/агента. Обновлять при каждом релизе.
> Версия: v6.2 (`src/config.js`). Пакет: `6.2.0-dev`.
> HEAD: `d0d389c` (`main`, после PR #4).
> Обновлено: 2026-10-19.

## 1. Что это

SPA-чат с AI-интеграцией (LM Studio), мультипользовательским режимом,
RAG, админ-панелью, играми и i18n.

- Клиент: vanilla JS, ES-модули, без сборщика.
- Серверы: LM Studio — `8034`; .NET Core API — `8032` (опционально);
  статика/IIS — `8033`.
- Репозиторий: https://github.com/iilmchat/infocom-lm-chat

## 2. Метрики

- KI всего: **50** (ID 001–051, `KI-024` отсутствует).
- **Fixed: 24**; **Open: 18**; In Progress: 2; Documented: 4;
  Deferred: 1; Won't Fix: 1. Сумма: 50.
- Приоритеты: Critical — 3; High — 12; Medium — 18; Low — 17.
- SPA-модулей: 7 (Chat, Private, Admin, Games, Profile, Settings, Stats).
- ES-модулей в `src/`: 67 `.js`.
- Тестов: 2 файла (RAGManager, SessionManager). `npm test` сломан:
  нет `tools/run-tests.js` (KI-041).
- Версия: `src/config.js` — 6.2; `index.html` и локали — 6.2;
  `package.json` — 6.2.0-dev.

## 3. Следующая задача

**KI-025 — Offline-mode / graceful degradation без бэкенда.**

- Приоритет: 🟠 High.
- Проблема: без API на `8032` консоль заполняется `ERR_CONNECTION_REFUSED`
  из `RoomList`, `MultiUserManager`, `AuthService`.
- План: флаг `offlineMode`; `apiService.pingBackend()` с timeout 2s;
  early return в менеджерах; индикатор «⚪ Бэкенд отключён»; кнопка
  «Повторить подключение».
- Файлы: `src/app.js`, `src/services/http-client.js`,
  `src/models/multi-user-manager.js`, `src/ui/views/room-list.js`,
  `src/services/auth-service.js`, `src/ui/views/chat-view.js`.

## 4. Открытые High/Critical

Critical Open: нет.

High Open:

- KI-002 — `locales/en.js` содержит русские строки;
- KI-005 — дублирование `Id`/`id`, `Name`/`name`, `Avatar`/`avatar`;
- KI-025 — нет offline-mode (следующая задача).

`KI-032`, `KI-035`, `KI-036`, `KI-031` уже закрыты/частично закрыты;
`KI-029` исправлен в коде. Не доверять статусам без проверки:
`pwsh tools/check-ki.ps1`.

## 5. Архитектура (кратко)

- Точка входа: `index.html` → `src/app.js` (`class App`).
- Ядро: `EventBus` (pub/sub), `Router` (History API), `ErrorBoundary`,
  `Storage`.
- `App` создаёт глобальный `Sidebar`; `ChatModule` создаёт только
  `ChatView`.
- Роутер: `/`, `/private`, `/admin`, `/games`, `/profile`, `/settings`,
  `/stats`; переключение — `App._showView`.
- Модули: Chat, Private, Admin, Games, Profile, Settings, Stats.
- Сервисы: `ApiService` (LM Studio), `ChatApiClient`/`http-client`
  (.NET), `AuthService`, `MarkdownService`, `Sanitizer`,
  `LongPollingClient`, `AvatarService`, `i18n`.
- Модели: `SessionManager`, `MultiUserManager`, `RAGManager`,
  `AssistantManager`, `AchievementManager`, `NotificationManager`,
  `WorkspaceManager`, `FileManager`, `ReactionManager`, `RateLimiter`,
  `InputHistory`, `EmbeddingCache`, `RoadmapTracker`.
- UI: `Sidebar`, `ChatView`, `Modal`, `Toast`, `DropZone`,
  `MessageRenderer`; CSS: `main`, `themes`, `chat`, `sidebar`, `modals`,
  `admin`, `private-chat`, `games`, `responsive`, `markdown`.
- Темы: dark (`:root`), light, monokai.
- localStorage: `chat_sessions_v5`, `chat_theme`, `app_language`,
  `sidebar_width`, `server_config`, `user_profile`.

## 6. Текущие задачи v6.2

- A. Глобальный sidebar — сделано (KI-003, KI-013, KI-033, KI-034).
- B. Визуал основного чата — в работе.
- C. Завершение i18n — в работе (KI-002, KI-007).
- D. Уведомления в приватных чатах — сделано (KI-004, KI-027).
- E. Реальные графики StatsModule — не начато (KI-006).
- F. Фиксы после рефакторинга — KI-035, KI-036, KI-032 закрыты.
- G. **Следующая задача — KI-025 (Offline-mode).**

## 7. Правила и ссылки

- [RULES.md](RULES.md) — правила кода, коммитов, KI, docs, PR, тестирования.
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура.
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) — реестр KI.
- [API.md](../API.md) — REST API.
- [GUIDE.md](../user-guide/GUIDE.md) — руководство пользователя.
- [MANUAL_TESTING_GUIDE.md](../qa/MANUAL_TESTING_GUIDE.md) — ручное тестирование.
- [Smoke v6.2](reports/v6.2/smoke-01-static.md) — static smoke.
- [../../README.md](../../README.md) — витрина.
- [../../CHANGELOG.md](../../CHANGELOG.md) — история версий.

## 8. Известные ловушки

- Без API `8032` — поток `ERR_CONNECTION_REFUSED` (KI-025).
- `locales/en.js` всё ещё на русском (KI-002).
- Смешение `Id`/`id` в API-моделях (KI-005).
- `npm test` падает: нет `tools/run-tests.js` (KI-041).
- `docs/API.md` — plain text v5.1, не Markdown (KI-045).
- `docs/PROJECT_OVERVIEW.md` устарел (KI-043).
- `docs/Промпт…` и `docs/Общая архитектура.txt` — исторические (KI-044).
- В `src/` 26 `console.log` (KI-048).
- `tools/check-ki.ps1` нужно запускать с `-ExecutionPolicy Bypass`.

## 9. Как проверить

1. Запустить статику на `8033`, LM Studio на `8034`; API `8032` — опционально.
2. Открыть `/`, `/private`, `/admin`, `/games`, `/profile`, `/settings`, `/stats`.
3. Проверить консоль, переключение тем, профиль (модалку и страницу),
   уведомления, ресайз sidebar.
4. Прогнать `docs/qa/MANUAL_TESTING_GUIDE.md` и
   `docs/development/reports/v6.2/smoke-01-static.md`.
5. Проверить Markdown: все fence закрыты, таблицы с `|`, ссылки живые.
6. `pwsh -ExecutionPolicy Bypass -File tools/check-ki.ps1` — сумма
   статусов должна совпадать с числом KI.
