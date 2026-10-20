<!-- Добавлено в 6.2: PROMPT_CURRENT.md на основе audit-01-docs.md (Фаза 4) -->
<!-- Изменено в 6.2: монорепозиторий client/ + server/ (KI-052) -->
# PROMPT_CURRENT.md — Infocom LM Chat Pro

> Актуальный контекст для нового чата/агента. Обновлять при каждом релизе.
> Версия: v6.2 (`client/src/config.js`). Пакет: `6.2.0-dev`.
> HEAD: `feature/offline-mode` (коммит KI-025, поверх `059c97a`).
> Обновлено: 2026-10-20.

## 1. Что это

SPA-чат с AI-интеграцией (LM Studio), мультипользовательским режимом,
RAG, админ-панелью, играми и i18n.

- Клиент: `client/` — vanilla JS, ES-модули, без сборщика.
- Сервер: `server/` — ASP.NET Core Web API (`netcoreapp3.1`),
  EF Core + MS SQL Server.
- Серверы: LM Studio — `8034`; .NET Core API — `8032` (опционально);
  статика/IIS — `8033`.
- Репозиторий: https://github.com/iilmchat/infocom-lm-chat

## 2. Метрики

- KI всего: **51** (ID 001–052, `KI-024` отсутствует).
- **Fixed: 26**; **Open: 17**; In Progress: 2; Documented: 4;
  Deferred: 1; Won't Fix: 1. Сумма: 51.
- Приоритеты: Critical — 3; High — 12; Medium — 19; Low — 17.
- SPA-модулей: 7 (Chat, Private, Admin, Games, Profile, Settings, Stats).
- ES-модулей в `client/src/`: 67 `.js`.
- Тестов: 2 файла (RAGManager, SessionManager). `npm test` сломан:
  нет `tools/run-tests.js` (KI-041).
- Версия: `client/src/config.js` — 6.2; `client/index.html` и локали — 6.2;
  `client/package.json` — 6.2.0-dev.

## 3. Следующая задача

**KI-025 — Offline-mode / graceful degradation — сделано** (ветка
`feature/offline-mode`, отчёт
[smoke-02-offline.md](reports/v6.2/smoke-02-offline.md)).

Дальше — High-задачи: **KI-002** (`locales/en.js` на английском) и
**KI-005** (`Id`/`id` в моделях).

## 4. Открытые High/Critical

Critical Open: нет.

High Open:

- KI-002 — `locales/en.js` содержит русские строки;
- KI-005 — дублирование `Id`/`id`, `Name`/`name`, `Avatar`/`avatar`.

`KI-032`, `KI-035`, `KI-036`, `KI-031` уже закрыты/частично закрыты;
`KI-029` исправлен в коде. Не доверять статусам без проверки:
`pwsh tools/check-ki.ps1`.

## 5. Архитектура (кратко)

- Точка входа: `client/index.html` → `client/src/app.js` (`class App`).
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
- Бэкенд (`server/`) — слоистая архитектура: `Controllers` → `Services`
  → `Data` (`DbContext`) → `Migrations`; MS SQL Server, JWT (`server/Auth/`),
  middleware (ошибки, rate limiting). Конфигурация —
  `server/appsettings.json`.

## 6. Текущие задачи v6.2

- A. Глобальный sidebar — сделано (KI-003, KI-013, KI-033, KI-034).
- B. Визуал основного чата — в работе.
- C. Завершение i18n — в работе (KI-002, KI-007).
- D. Уведомления в приватных чатах — сделано (KI-004, KI-027).
- E. Реальные графики StatsModule — не начато (KI-006).
- F. Фиксы после рефакторинга — KI-035, KI-036, KI-032 закрыты.
- G. KI-025 (Offline-mode) — сделано (2026-10-20).

## 7. Правила и ссылки

- [RULES.md](RULES.md) — правила кода, коммитов, KI, docs, PR, тестирования.
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура.
- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) — реестр KI.
- [API.md](../API.md) — REST API.
- [GUIDE.md](../user-guide/GUIDE.md) — руководство пользователя.
- [MANUAL_TESTING_GUIDE.md](../qa/MANUAL_TESTING_GUIDE.md) — ручное тестирование.
- [Smoke v6.2](reports/v6.2/smoke-01-static.md) — static smoke.
- [Offline smoke v6.2](reports/v6.2/smoke-02-offline.md) — KI-025.
- [../../README.md](../../README.md) — витрина.
- [../../CHANGELOG.md](../../CHANGELOG.md) — история версий.

## 8. Известные ловушки

- Клиент теперь в `client/`: пути `src/...` и `index.html` в корне
  не работают — только `client/...`.
- Статика раздаётся из `client/`, а не из корня (KI-052).
- `server/bin` и `server/obj` — в `.gitignore`, не коммитить.
- `server/appsettings.json` содержит строку подключения и параметры
  `Server`/`LM`: перед коммитом `server/` проверить секреты.
- Офлайн-режим (KI-025): при выключенном `8032` клиент работает как
  одиночный чат; ровно один `ERR_CONNECTION_REFUSED` в консоли — это
  штатный `pingBackend()`.
- `locales/en.js` всё ещё на русском (KI-002).
- Смешение `Id`/`id` в API-моделях (KI-005).
- `npm test` падает: нет `tools/run-tests.js` (KI-041).
- `docs/API.md` — plain text v5.1, не Markdown (KI-045).
- `docs/PROJECT_OVERVIEW.md` устарел (KI-043).
- `docs/Промпт…` и `docs/Общая архитектура.txt` — исторические (KI-044).
- В `src/` 26 `console.log` (KI-048).
- `tools/check-ki.ps1` нужно запускать с `-ExecutionPolicy Bypass`.

## 9. Как проверить

1. Запустить статику из `client/` на `8033` (или `tools/scripts/start-python.sh`),
   LM Studio на `8034`; API `8032` — опционально
   (`dotnet run --project server/InfocomChat.Server.csproj --urls http://localhost:8032`).
2. Открыть `/`, `/private`, `/admin`, `/games`, `/profile`, `/settings`, `/stats`.
3. Проверить консоль, переключение тем, профиль (модалку и страницу),
   уведомления, ресайз sidebar.
4. Прогнать `docs/qa/MANUAL_TESTING_GUIDE.md` и
   `docs/development/reports/v6.2/smoke-01-static.md`.
5. Проверить Markdown: все fence закрыты, таблицы с `|`, ссылки живые.
6. `pwsh -ExecutionPolicy Bypass -File tools/check-ki.ps1` — сумма
   статусов должна совпадать с числом KI.
7. Офлайн: выключить `8032`, перезагрузить страницу. Ожидается статус
   «⚪ Офлайн (Сервер выключен)», сообщение в списке комнат, работающий
   чат с LM Studio и не более одного `ERR_CONNECTION_REFUSED` в консоли
   (детали — [smoke-02-offline.md](reports/v6.2/smoke-02-offline.md)).
