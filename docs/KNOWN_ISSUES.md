# Infocom LM Chat Pro — Known Issues

> Реестр известных проблем/ограничений проекта.
> **Правило:** любая найденная проблема/ограничение → запись здесь.
> Даже «не баг» — фиксируется для истории.

**Легенда приоритетов:**
- 🔴 Critical — блокирует работу / крашит приложение
- 🟠 High — существенно ухудшает UX или архитектуру
- 🟡 Medium — заметно, но обходится
- 🟢 Low — косметика / nice-to-have

**Легенда статусов:**
- `Open` — известна, не взята в работу
- `In Progress` — сейчас в работе
- `Fixed` — исправлена
- `Documented` — задокументировано как ограничение (не планируется фиксить)
- `Deferred` — отложено на будущее
- `Won't Fix` — не будет исправлено

---

## KI-001 — `import ... assert { type: 'json' }` не поддерживается в браузерах

- **Приоритет:** 🔴 Critical
- **Статус:** Fixed (в v6.2)
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  При загрузке приложения возникает `Uncaught SyntaxError: Unexpected identifier 'assert'`
  в `src/services/i18n.js:4:40`. Синтаксис import assertions (`assert { type: 'json' }`)
  устарел и не поддерживается современными браузерами; в Chromium удалён, в Firefox
  требует флага.
- **Решение:**
  Локали переведены из `.json` в ES-модули (`locales/ru.js`, `locales/en.js`)
  с `export default { ... }`. В `i18n.js` импорты без assertions.
- **Затронутые файлы:**
  - `src/services/i18n.js`
  - `locales/ru.js` (был `ru.json`)
  - `locales/en.js` (был `en.json`)
- **Проверка:** консоль чистая, приложение стартует, `i18n.t('chat.send')` возвращает «Отправить».

---

## KI-002 — `en.js` содержит русские строки вместо английских

- **Приоритет:** 🟠 High
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  Файл `locales/en.js` полностью дублирует русский текст из `ru.js`.
  При переключении языка на `en` интерфейс остаётся на русском.
- **План:** перевести все ключи `en.js` на английский; вынести проверку
  «нет ли ключей с русскими символами» в тест.
- **Затронутые файлы:**
  - `locales/en.js`
  - `locales/ru.js` (эталон ключей)
- **Примечание:** после перевода — добавить `KI-XXX`-тест на паритет ключей
  `ru` и `en` (см. KI-011).

---

## KI-003 — Sidebar не является глобальным (внутри `#app-chat`)

- **Приоритет:** 🔴 Critical (архитектурный блокер v6.2)
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  Элемент `<div class="sidebar" id="sidebar">` находится внутри `#app-chat`.
  Из-за этого на страницах `#app-private`, `#app-admin`, `#app-games`,
  `#app-profile`, `#app-settings`, `#app-stats` сайдбар скрыт.
  Пользователь не может переключаться между модулями через единую навигацию.
- **План (Задача A v6.2):**
  1. Вынести `#sidebar` из `#app-chat` в корень `#app`.
  2. `Sidebar` создавать в `App`, а не в `ChatModule`.
  3. Методы `showChat/showPrivateChats/showAdmin/...` только скрывают/показывают
     `#app-*`, сайдбар остаётся видимым (кроме мобильных).
  4. Убрать вложенный сайдбар из `PrivateChatModule`.
- **Затронутые файлы:**
  - `index.html`
  - `src/app.js`
  - `src/modules/chat/ChatModule.js`
  - `src/modules/private/PrivateChatModule.js`
  - `src/ui/views/sidebar.js`
  - `src/styles/sidebar.css`
  - `src/styles/responsive.css`

---

## KI-004 — `NotificationManager.addNotification()` отсутствует

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  В `PrivateChatModule` вызывается
  `this.app.notificationManager.addNotification?.({...})`,
  но метод `addNotification` в классе `NotificationManager`
  не реализован. Опциональная цепочка (`?.`) маскировала ошибку —
  уведомления о приватных сообщениях и упоминаниях фактически не создавались.
- **Решение:**
  Реализован метод `addNotification({ type, title, body, data, silent })`:
  - Создаёт локальное уведомление с уникальным `notificationId` (префикс `local_`)
  - Добавляет в начало списка `this.notifications`
  - Инкрементирует `unreadCount`, обновляет бейдж
  - Эмитит событие `notifications:updated`
  - Показывает toast (если `silent !== true`)
  - Ограничивает размер списка (`MAX_LOCAL_NOTIFICATIONS = 100`)
  
  Заодно:
  - `fetchNotifications()` сохраняет локальные уведомления при обновлении с сервера
  - `markRead()` корректно обрабатывает локальные ID (без отправки их на сервер)
  - Добавлены `clearLocal()` и `_getIconForType()`
- **Затронутые файлы:**
  - `src/models/notification-manager.js`
- **Связанные:** KI-012, KI-027

---

## KI-005 — Дублирование полей `Id`/`id`, `Name`/`name`, `Avatar`/`avatar` в моделях

- **Приоритет:** 🟠 High
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `MultiUserManager.loadUser()` и связанных методах (`renderUsers`,
  `renderPrivateChats`, `updateUsers`) приходят объекты с разным
  регистром ключей (`.NET`-сериализация vs JS-стиль).
  Код наполняется «костылями» вида `user.Id || user.id`,
  что приводит к трудновоспроизводимым багам (часть UI показывает
  `undefined`, часть — реальные значения).
- **План:**
  1. Ввести нормализацию на границе API (`normalizeUser()` в `http-client.js`).
  2. Убрать двойные поля из моделей.
  3. Добавить unit-тест на нормализацию.
- **Затронутые файлы:**
  - `src/models/multi-user-manager.js`
  - `src/services/auth-service.js`
  - `src/services/http-client.js`
  - `src/ui/views/sidebar.js`
  - `src/ui/views/private-chat.js`

---

## KI-006 — `StatsModule` использует заглушки вместо графиков

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `StatsModule.renderCharts()` на canvas рисуется только текст
  «График активности (заглушка)». Реальные диаграммы отсутствуют.
- **План (Задача E v6.2):**
  1. Подключить Chart.js (локально, `<script>` в `index.html`).
  2. Реализовать `activityChart` и `distributionChart` на реальных данных.
  3. Добавить фильтры по дате/комнате/пользователю и экспорт CSV/JSON.
- **Затронутые файлы:**
  - `src/modules/stats/StatsModule.js`
  - `index.html`
  - `src/styles/*` (стили контейнеров графиков)

---

## KI-007 — i18n покрывает < 5% строк интерфейса

- **Приоритет:** 🟡 Medium
- **Статус:** In Progress (начат в v6.1)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Большинство текстов в `index.html`, `ChatModule`, `Sidebar`,
  `AdminModule`, `ProfileModule`, `PrivateChatModule` захардкожены на русском.
  В `i18n.js` есть только каркас, локали содержат ограниченный набор ключей.
- **План (Задача C v6.2):**
  1. Расширить `ru.js`/`en.js` до полного набора ключей.
  2. Заменить статические строки на `t('key')`.
  3. Добавить переключатель языка в шапку/профиль.
  4. Обеспечить реактивную смену без перезагрузки (`languageChanged`).
- **Затронутые файлы:**
  - `locales/ru.js`
  - `locales/en.js`
  - `index.html`
  - `src/app.js` и модули
  - `src/services/i18n.js`

---

## KI-008 — Устаревшие методы `startSync`/`stopSync` остаются в коде

- **Приоритет:** 🟢 Low
- **Статус:** Deferred
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `MultiUserManager` сохранены методы `startSync()`/`stopSync()`,
  помеченные как «Устарело в 5.1», но всё ещё доступные.
  Часть комментариев описывает их как актуальные.
- **План:** удалить в v6.3 после полного перехода на Long Polling.
- **Затронутые файлы:**
  - `src/models/multi-user-manager.js`

---

## KI-009 — Legacy-код `simulateUsers` и симуляция присутствуют в комментариях

- **Приоритет:** 🟢 Low
- **Статус:** Documented
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `MultiUserManager` и `App` присутствуют закомментированные
  блоки симуляции пользователей (`/* Удалено 5.4 ... */`).
  Это затрудняет чтение, но полезно для истории версий.
- **Решение:** оставить как «археологию» до v7.0, при большом рефакторе — вычистить.
- **Затронутые файлы:**
  - `src/models/multi-user-manager.js`
  - `src/app.js`

---

## KI-010 — Файлы локалей изменены с `.json` на `.js` — путь импорта в документации устарел

- **Приоритет:** 🟢 Low
- **Статус:** Fixed
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  В промпте проекта (`Промпт для нового чата …`) указан путь `locales/ru.json`,
  `locales/en.json`. После исправления KI-001 — это `.js`.
- **Решение:** обновить документацию/промпт.
- **Затронутые файлы:**
  - `Промпт для нового чата (продолжение разработки.txt)`
  - `src/services/i18n.js`

---

## KI-011 — Отсутствуют тесты на i18n, NotificationManager, WorkspaceManager

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  Есть unit-тесты для `RAGManager` и `SessionManager`, но нет тестов
  для `i18n` (паритет ключей ru/en), `NotificationManager`,
  `WorkspaceManager`, `AvatarService`.
- **План:**
  1. `i18n.test.js` — проверить, что все ключи `ru` есть в `en`, и наоборот;
     что `t('missing.key')` возвращает сам ключ и пишет warning.
  2. `notification-manager.test.js` — `addNotification`, `updateBadge`, polling.
  3. `workspace-manager.test.js` — CRUD, переключение, persist.
  4. `avatar-service.test.js` — все три типа аватаров.
- **Затронутые файлы:**
  - `src/utils/test-runner.js`
  - `tests/**` (создать)

---

## KI-012 — Опциональная цепочка (`?.`) скрывает отсутствующие методы

- **Приоритет:** 🟡 Medium
- **Статус:** In Progress (v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Многократное использование `foo?.()`, `bar?.field` в критических
  местах приводит к «тихим» отказам: код не падает, но и не работает.
- **Решение:**
  Для обязательных зависимостей — прямые вызовы без `?.`.
  В этом PR убран `?.` в вызовах `notificationManager.addNotification()`
  (2 места в `PrivateChatModule`). Метод теперь обязателен.
  Остальные места (`markdownService` как fallback) оставлены — они опциональны.
- **Затронутые файлы:**
  - `src/modules/private/PrivateChatModule.js`
- **Связанные:** KI-004

---

## KI-013 — `ChatModule` создаёт `Sidebar`/`ChatView` внутри себя, `App` дублирует ссылки

- **Приоритет:** 🟠 High
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `ChatModule.init()` создаются новые `Sidebar` и `ChatView`,
  а в `App.constructor` присваиваются `this.chatView = this.chatModule.chatView`
  и `this.sidebar = this.chatModule.sidebar`. При этом в `App` есть
  закомментированные геттеры (`get chatView() { ... }`), что
  говорит о незавершённом рефакторинге. Риск: два экземпляра сайдбара,
  если `ChatModule` создадут повторно.
- **План:** устранить как часть KI-003 (рефакторинг sidebar).
- **Затронутые файлы:**
  - `src/modules/chat/ChatModule.js`
  - `src/app.js`

---

## KI-014 — `attach { type: 'json' }` упомянут в документации проекта

- **Приоритет:** 🟢 Low
- **Статус:** Fixed
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  В архивных промптах/снапшотах (`04_services.txt`) фигурирует
  старый синтаксис. Это исторический артефакт.
- **Решение:** отмечено как исторический артефакт; не требует правок
  в исходниках.
- **Затронутые файлы:**
  - `04_services.txt` (архив)

---

## KI-015 — Нет `LICENSE` и `README` в репозитории

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  Планируется публикация на GitHub (https://github.com/iilmchat).
  Отсутствуют `LICENSE`, `README.md`, `.gitignore`.
- **План:** создать до первого пуша.
- **Затронутые файлы:**
  - `LICENSE` (создать)
  - `README.md` (создать)
  - `.gitignore` (создать)

---

## KI-016 — Legacy-код syntax-highlighter остался в проекте

- **Приоритет:** 🟡 Medium
- **Статус:** In Progress (архивация в v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Самописный сервис подсветки кода (`syntax-highlighter.js` и 4 связанных
  модуля + `useSyntaxHighlight.js`, ~37 KB) остался после перехода на
  `markdownService` + `highlight.js` в v5.2. Код не импортируется,
  но хранит ценную историю: реализацию worker-based подсветки, кэш,
  оптимизации.
- **Решение:**
  Не удалять! Перемещено в `docs/archive/legacy/syntax-highlighter/`
  (см. `tools/cleanup.ps1`). Сохранены все 6 файлов.
- **Затронутые файлы:**
  - `src/services/syntax-highlighter*.js` → `docs/archive/legacy/syntax-highlighter/`
  - `src/hooks/useSyntaxHighlight.js` → `docs/archive/legacy/syntax-highlighter/`
- **История:** см. коммиты v5.2 — момент отказа от самописной подсветки.

---

## KI-017 — Vendor-библиотеки лежат в `src/components/`

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  13 сторонних библиотек (`highlight.min.js`, `marked.min.js`, `purify.min.js`,
  `mammoth.browser.min.js`, `html2pdf.bundle.min.js`, `pdf.*`, `signalr.min.js`,
  `marked.esm.js`, `purify.es.mjs`, `pdf_viewer.min.css`) + тема
  `src/styles/atom-one-dark.min.css` лежат в исходниках.
  Сбивает с толку: `src/` — это наш код, а не библиотеки.
- **План:** переехать в `vendor/` (см. `tools/cleanup.ps1`), обновить пути в `index.html`.
- **Затронутые файлы:**
  - `src/components/*`
  - `src/styles/atom-one-dark.min.css`
  - `index.html`

---

## KI-018 — Дубликаты, черновики и заглушки в `src/`

- **Приоритет:** 🟡 Medium
- **Статус:** In Progress (уборка в v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `src/` найдены файлы, потерявшие актуальность. Разделены на две группы:
  
  **A. Архивируются** (историческая ценность, ~90 KB):
  - `src/ui/views/auth-modal.js`, `user-modal.js` — заменены `ProfileModal` (v5.3)
  - `src/utils/network-helpers_{js.txt,_new.js,_new.js.txt,_old.js}` — черновики
  - `src/utils/test-runner_Old.js`
  - `src/models/ses.js` — ранняя версия `session-manager.js`
  - `src/components/CodeEditor.jsx` — React-эксперимент в vanilla-JS

  **B. Удаляются** (заглушки без ценности):
  - `src/modules/admin/В app.js будем загружать этот модуль динамически.js`
  - `src/modules/games/В app.js`

- **Решение:**
  - Группа A → `docs/archive/legacy/` (см. `tools/cleanup.ps1`, секция F).
  - Группа B → удаление (см. `tools/cleanup.ps1`, секция I).

- **Затронутые файлы:** см. `tools/cleanup.ps1`.

---

## KI-019 — Итерации MiniMetro: 13 версий в updates/ + 2 legacy в src/games/

- **Приоритет:** 🟢 Low
- **Статус:** In Progress (уборка в v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  **В `updates/MiniMetro/src/games/`** — 13 итераций (`2mini-metro.js` …
  `12mini-metro.js`, `9спринт_mini-metro.js`, финальная `mini-metro.js`).
  Это **полная история разработки**, полезна для понимания эволюции
  алгоритмов.

  **В `src/games/`** — 2 устаревшие версии (`mini-metro_old.js`,
  `mini-metro_old1.js`). Дублируют промежуточные итерации из `updates/`
  и не используются в приложении.

- **Решение:**
  - `updates/MiniMetro/` → `docs/archive/mini-metro/` (13 файлов, ~700 KB).
  - `src/games/mini-metro_old*.js` → **удалить** (дублируют архив).

- **Затронутые файлы:** см. `tools/cleanup.ps1`, секции H (архив) и I (удаление).

---

## KI-020 — Документация `docs/` — 40+ файлов с русскими именами и без структуры

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  `docs/` содержит много одноразовых заметок с именами
  вроде `ИТОГ 13.txt`, `Теперь проект готов к переходу на v5.3.txt`,
  `Обновленная архитектура портов.txt` — без иерархии, без единого формата.
- **План:** разложить по подпапкам (`archive/v5.2/`, `archive/mini-metro/`,
  `planning/`, `architecture/`) — см. `tools/organize-docs.ps1`.
- **Затронутые файлы:** все `.txt` в `docs/`.

---

## KI-021 — `Infocom LM Chat.html` (538 KB) — устаревший экспорт приложения

- **Приоритет:** 🟢 Low
- **Статус:** In Progress (архивация в v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Полный HTML-снимок приложения. Не подключён нигде, но полезен
  для сравнения с текущим `index.html` и как «капсула времени».
- **Решение:**
  Переезд в `docs/archive/html-snapshots/`.
- **Затронутые файлы:**
  - `Infocom LM Chat.html` → `docs/archive/html-snapshots/Infocom LM Chat.html`

---

## KI-022 — Вспомогательные скрипты разбросаны по корню проекта

- **Приоритет:** 🟢 Low
- **Статус:** In Progress (уборка в v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Полезные утилиты лежат в корне рядом с `index.html`:
  - `build-archive.mjs` — генератор снапшотов кода
  - `create-structure.bat` — старый генератор структуры
  - `Node.js (live-server).sh` / `Python.sh` — команды запуска
  - `web.config` — конфиг IIS (для порта 8033)
  Смешиваются с исходниками, сбивают с толку.
- **Решение:**
  - `build-archive.mjs` → `tools/build-archive.mjs`
  - `create-structure.bat` → `tools/archive/` (историческое)
  - `Node.js (live-server).sh` → `tools/scripts/start-live-server.sh`
  - `Python.sh` → `tools/scripts/start-python.sh`
  - `web.config` — **остаётся в корне** (требование IIS)
- **Затронутые файлы:**
  - `build-archive.mjs`, `create-structure.bat`
  - `Node.js (live-server).sh`, `Python.sh`
  - `web.config` (не перемещается)
  - `README.md` (обновить раздел «Развёртывание»)

---

## KI-023 — `web.config`: SPA-роутинг через URL Rewrite (IIS)

- **Приоритет:** 🟡 Medium
- **Статус:** In Progress (v6.2)
- **Дата открытия:** 2026-09-17
- **Описание:**
  Проект использует SPA-роутинг на History API (`/`, `/private`, `/admin` и т.д.).
  При прямом заходе на `http://host:8033/private` IIS вернёт `404`, если нет
  rewrite-правила. Изначально `web.config` использовал `httpErrors 404 → index.html`,
  что даёт некорректный HTTP-статус (404 вместо 200).
- **Решение (v6.2):**
  Добавлено правило `<rewrite>` для SPA. Требует установленного
  **URL Rewrite Module 2.0** ([скачать](https://www.iis.net/downloads/microsoft/url-rewrite)).
  
  Fallback через `httpErrors` оставлен закомментированным — если модуль не
  установлен, можно раскомментировать (с потерей правильного HTTP-статуса).
  
  Заодно поправлено:
  - MIME-типы для `.mjs`, `.json`, `.webmanifest`
  - `X-Frame-Options: ALLOWALL` → `SAMEORIGIN`
  - Убраны CORS-заголовки (не нужны при same-origin)
  - Убран `X-Powered-By`

- **Затронутые файлы:**
  - `web.config`
  - `README.md` (раздел «Развёртывание → IIS»)

- **Проверка деплоя:**
  1. Открыть напрямую `http://host:8033/private` — должен отдать index.html с кодом **200**
  2. Открыть `http://host:8033/admin` — то же
  3. Открыть `http://host:8033/src/app.js` — реальный файл, не index.html
  4. Открыть `http://host:8033/vendor/highlight.min.js` — реальный файл

---

---

## KI-025 — Нет graceful degradation при отсутствии бэкенда (порт 8032)

- **Приоритет:** 🟠 High (UX)
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  При запуске приложения без бэкенд-сервера на `127.0.0.1:8032` консоль
  заполняется `ERR_CONNECTION_REFUSED` (5+ источников):
  - `RoomList.loadRooms` — комнаты
  - `MultiUserManager.loadPrivateChats` — приватные чаты
  - `MultiUserManager.fetchUserInfo` — инфо о пользователе
  - `AuthService.getUser` / `restoreSession` — сессия
  Каждый падает с `TypeError: Failed to fetch`, ErrorBoundary логирует.
  
  Приложение **продолжает работать** (чат с LM Studio на 8034 доступен),
  но UX плохой: непонятно, что бэкенд — опциональная часть.

- **План:**
  1. Добавить флаг `offlineMode` в `App` и/или `CONFIG`.
  2. На старте — проверка `apiService.pingBackend()` (быстрый HEAD/POST
     на `http://127.0.0.1:8032/api/sync/ping` с timeout 2s).
  3. Если недоступен — выставить `offlineMode = true`, показать
     уведомление: «Бэкенд недоступен. Работаем в режиме одиночного чата».
  4. В `MultiUserManager`, `RoomList`, `AuthService` — early return,
     если `offlineMode`.
  5. В UI — индикатор «⚪ Бэкенд отключён» в шапке.
  6. Опционально: кнопка «Повторить подключение».
  
- **Затронутые файлы:**
  - `src/app.js`
  - `src/services/http-client.js` (метод `pingBackend`)
  - `src/models/multi-user-manager.js`
  - `src/ui/views/room-list.js`
  - `src/services/auth-service.js`
  - `src/ui/views/chat-view.js` (индикатор)
  - `README.md` (раздел «Требования»)

- **Связанные:** нет
- **Примечание:** решено делать **после первого публичного коммита**,
  отдельной веткой `feature/offline-mode`.

---

## KI-026 — README.md: сломана разметка code-fence и таблиц

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  При сохранении README.md через PowerShell here-string потеряны:
  - Закрывающие ` ``` ` в блоках «Клонирование», «Запуск сервера», «Структура»
  - Заголовки разделов `## 2. Запуск LM Studio`, `## 3. Запуск статического сервера`
  - Разметка таблиц «Горячие клавиши» и «Известные проблемы»
  - Ярлыки языков (` ```bash `, ` ```text `) стали обычным текстом
  
  Контент цел, но markdown-рендер на GitHub выглядит неопрятно.
  
- **План:**
  1. Открыть `README.md` в VS Code (или Notepad).
  2. Восстановить закрывающие ` ``` ` для всех code-блоков.
  3. Восстановить `##` для секций 2 и 3 в «Быстром старте».
  4. Переписать таблицы с `|`.
  
- **Альтернатива:** перегенерировать README из чистого шаблона (в `docs/README_TEMPLATE.md`).
- **Затронутые файлы:**
  - `README.md`

---

## KI-027 — Уведомления при загрузке истории приватных чатов

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  В `PrivateChatModule.loadHistory()` при `append === false`
  (каждые 5 секунд через polling + при первом открытии чата)
  выполнялся проход по всем сообщениям от собеседника и для каждого
  вызывался `addNotification`. При открытии чата с историей в 50 сообщений
  это дало бы 50 тостов и +50 к бейджу **каждые 5 секунд**.
- **Решение:**
  Введён трекинг `_seenMessageIds: Set` и флаг `_notificationInitialized`.
  - При первой загрузке чата — только запоминаем ID, уведомления не шлём
  - При последующих загрузках — уведомляем только о реально новых ID
  - Set ограничен 500 элементами (обрезается до последних 300)
  - Сбрасывается при смене чата (`openChat()`)
- **Затронутые файлы:**
  - `src/modules/private/PrivateChatModule.js`
- **Связанные:** KI-004

---

## KI-028 — Опечатка `localUser.Id` вместо `localUser.id` в `sendMentionNotifications`

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  В `PrivateChatModule.sendMentionNotifications()` условие
  `userId !== this.app.multiUserManager.localUser.Id`
  использует `.Id` (PascalCase). В проекте исторически смешаны `.Id` и `.id`
  (см. KI-005). Если у пользователя есть только `.id`, условие всегда истинно,
  и пользователь получает уведомления о своих собственных упоминаниях.
- **Решение:** Унифицировать через `||` fallback (как в других местах),
  либо нормализовать поля на границе API (см. KI-005).
- **Затронутые файлы:**
  - `src/modules/private/PrivateChatModule.js`
- **Связанные:** KI-005, KI-004

---

## KI-029 — Модель в UI показывает «local-model» вместо загруженной с сервера

- **Приоритет:** 🟠 High
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  При первом запуске (или после очистки localStorage) в шапке
  отображается «Модель: local-model», хотя `ApiService.fetchModels()`
  успешно загружает 14 моделей и выбирает `gemma-4-12b-coder-fable5-composer2.5-v1`
  (видно в консоли). Это вводит пользователя в заблуждение — модель
  для генерации фактически используется правильная, но UI показывает
  несуществующую.

  **Цепочка причин:**

  1. `SessionManager.defaultModel = 'local-model'` — хардкод, не связан с `CONFIG.UI_CONFIG.DEFAULT_MODEL`.
  2. `SessionManager.create()` использует legacy-выражение `typeof currentModel !== 'undefined'`
     (глобальной переменной давно нет) → всегда fallback на `'local-model'`.
  3. `App.init()` вызывает `getModelForChat()` **после** `checkServer()`,
     но результат перезаписывает `App.currentModel`, не синхронизируясь с
     `ApiService.currentModel` (который уже содержит правильное значение).

- **Решение:**
  1. `SessionManager`: заменить хардкод `'local-model'` на `CONFIG.UI_CONFIG.DEFAULT_MODEL`.
  2. `SessionManager.create()`: убрать legacy-проверку `typeof currentModel`,
     всегда использовать переданный `model` или `CONFIG.UI_CONFIG.DEFAULT_MODEL`.
  3. `SessionManager.getModelForChat()`: добавить валидацию — если сохранённая
     модель не входит в список доступных, вернуть `CONFIG.UI_CONFIG.DEFAULT_MODEL`.
  4. `App.init()`: синхронизировать `this.currentModel = this.api.currentModel`
     **после** `checkServer()`, но **до** `renderModelDropdown()`.
  5. `App.init()`: для текущей сессии проверить, что `session.model` существует
     в `api.availableModels`; если нет — обновить на `api.currentModel`.

- **Затронутые файлы:**
  - `src/models/session-manager.js`
  - `src/app.js`
- **Связанные:** KI-005 (смешение `.Id`/`.id` — та же семья проблем с legacy-полями)

---

## KI-030 — Внешний API ProjectManager (не наш скоуп)

- **Приоритет:** 🟢 Low
- **Статус:** Won't Fix
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-17
- **Описание:**
  Была получена документация API ProjectManager (аутентификация,
  проекты, владельцы, документы с версионностью) — предположительно
  как возможная замена или дополнение к нашему бэкенду.
- **Решение:**
  По уточнению владельца проекта — **этот API не относится к
  Infocom LM Chat Pro**. Проект использует собственный .NET Core 3.1 API
  (порт 8032, см. `docs/API.md`). Документация ProjectManager
  игнорируется, интеграция не планируется.
- **Затронутые файлы:** —
- **Связанные:** нет

---

## KI-031 — `ProfileModal.setMode('login')` падает из-за отсутствующего `#userColorInput`

- **Приоритет:** 🔴 Critical
- **Статус:** Fixed (v6.2)
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-18
- **Описание:**
  ... (оставить как было)
- **Решение:**
  В `ProfileModal.setMode()` обращение к `#userColorInput` заменено на
  `#initialsColorInput` (это правильный ID). Все обращения к полям
  обёрнуты в `if (el)` — предотвращает краш при частично построенной
  разметке модалки.
  Дополнительно: `setMode('login')` теперь безопасен, если часть полей
  ещё не создана — `init()` больше не падает, `setupEventListeners()`
  вызывается, весь UI регистрирует обработчики корректно.

- **Затронутые файлы:**
  - `src/ui/views/profile-modal.js`
- **Связанные:** KI-029 (тоже про инициализацию)

---

## KI-032 — Отсутствовали btn-переменные в тёмной теме (`:root`)

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Дата открытия:** 2026-09-18
- **Дата закрытия:** 2026-09-18
- **Описание:**
  В `themes.css` btn-переменные (`--btn-primary-bg`, `--btn-secondary-bg`,
  `--btn-danger-bg`, `--btn-success-bg`, `--btn-warning-bg` и их hover/text
  вариации) были определены только для тем `[data-theme="light"]` и
  `[data-theme="monokai"]`. Дефолтная тёмная тема (определена через `:root`
  в `main.css`) этих переменных **не содержала**. Как следствие:
  - Кнопки на тёмной теме не имели корректных цветов
  - Переключение через кнопку 🎨 не давало визуального эффекта
    для btn-классов (только для bg/text/border)

- **Решение:**
  Добавлены btn-переменные в `:root` (тёмная тема по умолчанию):
  ```css
  :root {
      --btn-border-radius: 8px;
      --btn-primary-bg: #7ec8e3;
      --btn-primary-hover: #5fb0d0;
      --btn-primary-text: #1a1a2e;
      --btn-secondary-bg: rgba(255,255,255,0.08);
      --btn-secondary-hover: rgba(255,255,255,0.15);
      --btn-secondary-text: var(--text-primary);
      --btn-danger-bg: #e74c3c;
      --btn-danger-hover: #c0392b;
      --btn-danger-text: #fff;
      --btn-success-bg: #2ecc71;
      --btn-success-hover: #27ae60;
      --btn-success-text: #1a1a2e;
      --btn-warning-bg: #f39c12;
      --btn-warning-hover: #e67e22;
      --btn-warning-text: #1a1a2e;
  }


## Шаблон для новой записи

```markdown
## KI-XXX — Краткое название

- **Приоритет:** 🔴/🟠/🟡/🟢
- **Статус:** Open / In Progress / Fixed / Documented / Deferred / Won't Fix
- **Дата открытия:** YYYY-MM-DD
- **Дата закрытия:** YYYY-MM-DD (если Fixed)
- **Описание:**
  Что именно не так, при каких условиях воспроизводится, что видит пользователь.
- **План / Решение:**
  Как планируется/было исправлено.
- **Затронутые файлы:**
  - `path/to/file1.js`
  - `path/to/file2.js`
- **Связанные:** KI-YYY (если есть)