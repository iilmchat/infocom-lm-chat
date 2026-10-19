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
- `Fixed (Partial)` — исправлена частично; остаток вынесен в отдельный KI
- `Documented` — задокументировано как ограничение (не планируется фиксить)
- `Deferred` — отложено на будущее
- `Won't Fix` — не будет исправлено

<!-- Изменено в 6.2: статусы синхронизированы по audit-01-docs.md; в Fixed-блоки добавлено поле «Исправлено в» -->

---

## KI-001 — `import ... assert { type: 'json' }` не поддерживается в браузерах

- **Приоритет:** 🔴 Critical
- **Статус:** Fixed (в v6.2)
- **Исправлено в:** v6.2
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

- **Приоритет:** 🔴 Critical
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-18
- **Описание:**
  Элемент `<div class="sidebar" id="sidebar">` находился внутри `#app-chat`.
  Из-за этого на страницах `#app-private`, `#app-admin`, `#app-games`,
  `#app-profile`, `#app-settings`, `#app-stats` sidebar был скрыт.
- **Решение:**
  1. `#sidebar` и `#sidebarOverlay` вынесены из `#app-chat` в корень `#app`.
  2. `Sidebar` создаётся в конструкторе `App`, а не в `ChatModule`.
  3. Все методы `show*()` больше не переключают `sidebar.style.display`.
  4. `ChatModule` отвечает только за `ChatView`.
  5. `PrivateChatModule` — убран вложенный sidebar со списком чатов.
  6. Клик по приватному чату в глобальном sidebar → `router.navigate('/private')`
     + открытие чата в `PrivateChatModule` (через `App.openPrivateChatById`).
- **Затронутые файлы:**
  - `index.html`
  - `src/styles/main.css`
  - `src/app.js`
  - `src/modules/chat/ChatModule.js`
  - `src/modules/private/PrivateChatModule.js`
  - `src/ui/views/sidebar.js`
- **Связанные:** KI-013, KI-033, KI-034

---

## KI-004 — `NotificationManager.addNotification()` отсутствует

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
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
<!-- Изменено в 6.2: KI-010 переведён из Fixed в Open — документация/промпт не обновлены -->
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  В промпте проекта (`Промпт для нового чата …`) указан путь `locales/ru.json`,
  `locales/en.json`. После исправления KI-001 — это `.js`.
- **Решение:** не исправлено. В `docs/Промпт для нового чата (продолжение разработки Infocom LM Chat Pro v6.0 → v6.1).txt:98`
  по-прежнему указаны `locales/ru.json` и `locales/en.json`. Требуется заменить на `.js`.
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
<!-- Изменено в 6.2: KI-012 переведён из In Progress в Documented — остальные ?. оставлены осознанно -->
- **Статус:** Documented
- **Дата открытия:** 2026-09-17
- **Описание:**
  Многократное использование `foo?.()`, `bar?.field` в критических
  местах приводит к «тихим» отказам: код не падает, но и не работает.
- **Решение:**
  Для обязательных зависимостей — прямые вызовы без `?.`.
  В `src/modules/private/PrivateChatModule.js:646-650` убран `?.` в вызовах
  `notificationManager.addNotification()` (2 места). Метод теперь обязателен.
  Остальные места (`markdownService` как fallback) оставлены осознанно —
  они опциональны; дальнейшая зачистка не планируется.
- **Затронутые файлы:**
  - `src/modules/private/PrivateChatModule.js`
- **Связанные:** KI-004

---

## KI-013 — ChatModule создаёт Sidebar/ChatView, App дублирует ссылки

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-18
- **Описание:**
  В `ChatModule.init()` создавались новые `Sidebar` и `ChatView`, а в `App.constructor`
  присваивались `this.chatView = this.chatModule.chatView` и
  `this.sidebar = this.chatModule.sidebar`. Риск: два экземпляра, если
  `ChatModule` создадут повторно.
- **Решение:**
  - `Sidebar` создаётся **только в `App`** (`this.sidebar = new Sidebar(this)`).
  - `ChatModule` создаёт только `ChatView`.
  - Убраны дублирующие ссылки в `App`.
- **Затронутые файлы:**
  - `src/app.js`
  - `src/modules/chat/ChatModule.js`
- **Связанные:** KI-003

---

## KI-014 — `attach { type: 'json' }` упомянут в документации проекта

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: KI-014 переведён из Fixed в Documented — это исторический артефакт, а не фикс -->
- **Статус:** Documented
- **Дата открытия:** 2026-09-17
- **Описание:**
  В архивных промптах/снапшотах (`04_services.txt`) фигурирует
  старый синтаксис. Это исторический артефакт.
- **Решение:** оставлено как исторический артефакт. Актуальный код использует
  ES-модули `locales/ru.js` и `locales/en.js`; архивный
  `docs/archive/snapshots/04_services.txt` не правится.
- **Затронутые файлы:**
  - `04_services.txt` (архив)

---

## KI-015 — Нет `LICENSE` и `README` в репозитории

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-015 переведён из Open в Fixed — файлы уже созданы -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  Планируется публикация на GitHub (https://github.com/iilmchat).
  Отсутствуют `LICENSE`, `README.md`, `.gitignore`.
- **Решение:**
  Все три файла присутствуют в корне репозитория: `LICENSE`, `README.md`,
  `.gitignore`. README требует переписывания по KI-042/KI-026, но сам файл
  создан.
- **Затронутые файлы:**
  - `LICENSE`
  - `README.md`
  - `.gitignore`

---

## KI-016 — Legacy-код syntax-highlighter остался в проекте

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-016 переведён из In Progress в Fixed — legacy-файлы уже в архиве -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  Самописный сервис подсветки кода (`syntax-highlighter.js` и 4 связанных
  модуля + `useSyntaxHighlight.js`, ~37 KB) остался после перехода на
  `markdownService` + `highlight.js` в v5.2. Код не импортируется,
  но хранит ценную историю: реализацию worker-based подсветки, кэш,
  оптимизации.
- **Решение:**
  Не удалять! Файлы находятся в `docs/archive/legacy/syntax-highlighter/`
  (6 файлов: `cache.js`, `main.js`, `optimizations.js`,
  `syntax-highlighter.js`, `useSyntaxHighlight.js`, `worker.js`).
  В `src/services/` и `src/hooks/` этих файлов нет.
- **Затронутые файлы:**
  - `src/services/syntax-highlighter*.js` → `docs/archive/legacy/syntax-highlighter/`
  - `src/hooks/useSyntaxHighlight.js` → `docs/archive/legacy/syntax-highlighter/`
- **История:** см. коммиты v5.2 — момент отказа от самописной подсветки.

---

## KI-017 — Vendor-библиотеки лежат в `src/components/`

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-017 переведён из Open в Fixed — библиотеки уже в vendor/ -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  13 сторонних библиотек (`highlight.min.js`, `marked.min.js`, `purify.min.js`,
  `mammoth.browser.min.js`, `html2pdf.bundle.min.js`, `pdf.*`, `signalr.min.js`,
  `marked.esm.js`, `purify.es.mjs`, `pdf_viewer.min.css`) + тема
  `src/styles/atom-one-dark.min.css` лежат в исходниках.
  Сбивает с толку: `src/` — это наш код, а не библиотеки.
- **Решение:**
  Библиотеки находятся в `vendor/`; `index.html` ссылается на них
  (`index.html:21-30`, например `vendor/highlight.min.js`).
  Каталога `src/components/` и файла `src/styles/atom-one-dark.min.css` нет.
- **Затронутые файлы:**
  - `vendor/*`
  - `index.html`
  - `src/styles/atom-one-dark.min.css` (удалён из `src/`)

---

## KI-018 — Дубликаты, черновики и заглушки в `src/`

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-018 переведён из In Progress в Fixed — дубликаты уже в архиве -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
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
  - Группа A → `docs/archive/legacy/`:
    `docs/archive/legacy/modals/auth-modal.js`,
    `docs/archive/legacy/modals/user-modal.js`,
    `docs/archive/legacy/models/ses.js`,
    `docs/archive/legacy/CodeEditor.jsx`,
    `docs/archive/legacy/test-runner_Old.js`,
    `docs/archive/legacy/network-helpers/`.
  - Группа B удалена; в `src/modules/admin/` и `src/modules/games/` этих файлов нет.
  - Дублей в `src/` не осталось.

- **Затронутые файлы:** см. `tools/cleanup.ps1`.

---

## KI-019 — Итерации MiniMetro: 13 версий в updates/ + 2 legacy в src/games/

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: KI-019 переведён из In Progress в Fixed — итерации уже в archive/mini-metro -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  **В `updates/MiniMetro/src/games/`** — 13 итераций (`2mini-metro.js` …
  `12mini-metro.js`, `9спринт_mini-metro.js`, финальная `mini-metro.js`).
  Это **полная история разработки**, полезна для понимания эволюции
  алгоритмов.

  **В `src/games/`** — 2 устаревшие версии (`mini-metro_old.js`,
  `mini-metro_old1.js`). Дублируют промежуточные итерации из `updates/`
  и не используются в приложении.

- **Решение:**
  - `updates/MiniMetro/` → `docs/archive/mini-metro/` — 19 файлов.
  - `src/games/mini-metro_old*.js` удалены; в `src/games/` остался
    рабочий `mini-metro.js`.

- **Затронутые файлы:** см. `tools/cleanup.ps1`, секции H (архив) и I (удаление).

---

## KI-020 — Документация `docs/` — 40+ файлов с русскими именами и без структуры

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-020 подтверждён как Open — структура archive/planning создана, но 2 .txt остались в корне docs/ -->
- **Статус:** Open
- **Дата открытия:** 2026-09-17
- **Описание:**
  `docs/` содержит много одноразовых заметок с именами
  вроде `ИТОГ 13.txt`, `Теперь проект готов к переходу на v5.3.txt`,
  `Обновленная архитектура портов.txt` — без иерархии, без единого формата.
  На 2026-10-19 основная часть разложена по `archive/` и `planning/`,
  но в корне `docs/` остались `Общая архитектура.txt` и
  `Промпт для нового чата (… v6.0 → v6.1).txt`.
- **План:** разложить по подпапкам (`archive/v5.2/`, `archive/mini-metro/`,
  `planning/`, `architecture/`) — см. `tools/organize-docs.ps1`.
- **Затронутые файлы:** все `.txt` в `docs/`.

---

## KI-021 — `Infocom LM Chat.html` (538 KB) — устаревший экспорт приложения

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: KI-021 переведён из In Progress в Fixed — снимок уже в archive/html-snapshots -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  Полный HTML-снимок приложения. Не подключён нигде, но полезен
  для сравнения с текущим `index.html` и как «капсула времени».
- **Решение:**
  Файл находится в `docs/archive/html-snapshots/Infocom LM Chat.html`;
  в корне репозитория его нет.
- **Затронутые файлы:**
  - `docs/archive/html-snapshots/Infocom LM Chat.html`

---

## KI-022 — Вспомогательные скрипты разбросаны по корню проекта

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: KI-022 переведён из In Progress в Fixed — утилиты уже в tools/ -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  Полезные утилиты лежат в корне рядом с `index.html`:
  - `build-archive.mjs` — генератор снапшотов кода
  - `create-structure.bat` — старый генератор структуры
  - `Node.js (live-server).sh` / `Python.sh` — команды запуска
  - `web.config` — конфиг IIS (для порта 8033)
  Смешиваются с исходниками, сбивают с толку.
- **Решение:**
  - `tools/build-archive.mjs`
  - `tools/archive/create-structure.bat`
  - `tools/scripts/start-live-server.sh`
  - `tools/scripts/start-python.sh`
  - `web.config` — **остаётся в корне** (требование IIS)
  В корне репозитория этих скриптов больше нет.
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
<!-- Изменено в 6.2: KI-025 исправлен — реализован offline-mode -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-20
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
- **Решение:**
  1. `ChatApiClient.pingBackend()` — `GET ${baseUrl}/sync/ping` с
     `AbortSignal.timeout(2000)`; возвращает `true` только при
     `response.ok`, при любой ошибке/таймауте — `false`.
  2. `App.init()` после `api.checkServer()` вычисляет
     `this.offlineMode = !(await this.apiService.pingBackend())`.
     При офлайне: toast «Бэкенд недоступен. Включен офлайн-режим.»,
     `#statusDisplay` → «⚪ Офлайн (Сервер выключен)»,
     цвет `var(--warning-color)`. При доступном бэкенде (и LM Studio) —
     «● Сервер доступен».
  3. Early return при `offlineMode`:
     `NotificationManager.fetchNotifications` / `startPolling`,
     `MultiUserManager.connectToServer` / `loadPrivateChats` /
     `getUnreadCount`, `RoomList.loadRooms` / `createRoom` /
     `searchRooms`, `AuthService.restoreSession` (возвращает `null`).
     Сетевые запросы не выполняются.
  4. `App.init()` при офлайне не вызывает `restoreSession`,
     `fetchNotifications`, `connectToServer` и не открывает форму входа.
  5. `Sidebar.render()` показывает в списке комнат «Мультиплеер
     недоступен в офлайн-режиме» и не вызывает `loadRooms()`.
  6. Кнопка `#connectBtn` при офлайне показывает warning и не делает
     запрос.
- **Затронутые файлы:**
  - `client/src/services/http-client.js` (`pingBackend`)
  - `client/src/app.js` (`offlineMode`, `init`)
  - `client/src/models/notification-manager.js`
  - `client/src/models/multi-user-manager.js`
  - `client/src/ui/views/room-list.js`
  - `client/src/services/auth-service.js`
  - `client/src/ui/views/sidebar.js`
- **Проверка:** [smoke-02-offline.md](development/reports/v6.2/smoke-02-offline.md)
- **Связанные:** KI-030 (внешний API ProjectManager — не наш бэкенд)

---

## KI-026 — README.md: сломана разметка code-fence и таблиц

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: KI-026 закрыт — README переписан, все fence и таблицы исправлены -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  При сохранении README.md через PowerShell here-string потеряны:
  - Закрывающие ` ``` ` в блоках «Клонирование», «Запуск сервера», «Структура»
  - Заголовки разделов `## 2. Запуск LM Studio`, `## 3. Запуск статического сервера`
  - Разметка таблиц «Горячие клавиши» и «Известные проблемы»
  - Ярлыки языков (` ```bash `, ` ```text `) стали обычным текстом
  
  Контент цел, но markdown-рендер на GitHub выглядит неопрятно.
  В v6.2 `README.md` переписан: все code-fence парные, заголовки `##`
  восстановлены, таблицы оформлены через `|`.
  
- **Решение:**
  `README.md` переписан с нуля (150+ строк): актуальные требования,
  быстрый старт, структура проекта, функции, горячие клавиши, топ-5 KI,
  ссылки на `docs/`. Ссылки на несуществующие файлы удалены.
- **Затронутые файлы:**
  - `README.md`

---

## KI-027 — Уведомления при загрузке истории приватных чатов

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
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
<!-- Изменено в 6.2: KI-028 переведён из Open в Fixed — используется .id и есть нормализация -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
- **Описание:**
  В `PrivateChatModule.sendMentionNotifications()` условие
  `userId !== this.app.multiUserManager.localUser.Id`
  использует `.Id` (PascalCase). В проекте исторически смешаны `.Id` и `.id`
  (см. KI-005). Если у пользователя есть только `.id`, условие всегда истинно,
  и пользователь получает уведомления о своих собственных упоминаниях.
- **Решение:**
  В `src/modules/private/PrivateChatModule.js:650` используется `.id`.
  `MultiUserManager.loadUser()` нормализует `.Id`/`.id` при загрузке
  (`src/models/multi-user-manager.js:103-106`), поэтому оба поля доступны.
- **Затронутые файлы:**
  - `src/modules/private/PrivateChatModule.js`
  - `src/models/multi-user-manager.js`
- **Связанные:** KI-005, KI-004

---

## KI-029 — Модель в UI показывает «local-model» вместо загруженной с сервера

- **Приоритет:** 🟠 High
<!-- Изменено в 6.2: KI-029 переведён из Open в Fixed — код уже синхронизирует модель -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-10-19
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
  1. `src/models/session-manager.js:31-32` — `defaultModel` берётся из
     `CONFIG.UI_CONFIG.DEFAULT_MODEL`.
  2. `src/models/session-manager.js:465-467` — `create()` использует
     `model || this.defaultModel`, legacy-проверка `typeof currentModel` убрана.
  3. `src/models/session-manager.js:638-647` — `getModelForChat()` валидирует
     сохранённую модель по `api.availableModels`.
  4. `src/app.js:624-626` — `App.currentModel` синхронизируется с
     `ApiService.currentModel` после `checkServer()`.
  5. `src/app.js` обновляет `session.model`, если сохранённой модели нет
     в списке доступных.
  Остаточный fallback `'local-model'` в `src/ui/views/sidebar.js:108`
  вынесен в отдельный KI-049.

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
<!-- Изменено в 6.2: KI-031 переведён в Fixed (Partial); остаток вынесен в KI-035 -->
- **Статус:** Fixed (Partial)
- **Исправлено в:** v6.2 (partial)
- **Дата открытия:** 2026-09-17
- **Дата закрытия:** 2026-09-18
- **Описание:**
  `ProfileModal.setMode('login')` падал из-за обращения к несуществующему
  `#userColorInput`. В модалке используется `#initialsColorInput`, а часть
  полей может отсутствовать при первой инициализации.
- **Решение:**
  В `src/ui/views/profile-modal.js:124-150` обращение к `#userColorInput`
  заменено на `#initialsColorInput`; ключевые обращения к полям обёрнуты
  в проверки `if (el)`. `setMode('login')` больше не падает.
  **Остаток:** в `src/ui/views/profile-modal.js:386` осталось прямое
  обращение `document.getElementById('userColorInput').value` без guard;
  оно вынесено в KI-035 вместе с крашем страницы `/profile`.

- **Затронутые файлы:**
  - `src/ui/views/profile-modal.js`
- **Связанные:** KI-029 (тоже про инициализацию)

---

## KI-032 — Отсутствовали btn-переменные в тёмной теме (`:root`)

- **Приоритет:** 🟠 High
<!-- Изменено в 6.2: KI-032 исправлен — btn-переменные добавлены в :root (KI-036) -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-18
- **Дата закрытия:** 2026-10-19
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
  В `src/styles/main.css` в блок `:root` добавлен полный набор `--btn-*`
  (16 переменных: border-radius, primary, secondary, danger, success, warning).
  Тёмная тема больше не зависит от `themes.css`; `[data-theme="light"]` и
  `[data-theme="monokai"]` сохраняют собственные значения.

---

## KI-033 — View-switching не скрывает все контейнеры одновременно

- **Приоритет:** 🟠 High
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-18
- **Дата закрытия:** 2026-09-18
- **Описание:**
  При переходе на `/settings` или `/stats` контейнер `#app-chat`
  оставался видимым — чат и настройки отображались одновременно.
  Причина: каждый `show*()` вручную перечислял 7 контейнеров и
  устанавливал им `display: none` — легко забыть один или
  получить рассинхрон при двойном срабатывании роутера.
- **Решение:**
  Введена утилита `App._showView(viewId)` — единая точка
  переключения. Все `show*()` теперь вызывают только её.
- **Затронутые файлы:**
  - `src/app.js`
- **Связанные:** KI-003

---

## KI-034 — Sidebar нельзя изменять по ширине (feature request)

- **Приоритет:** 🟢 Low
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-09-18
- **Дата закрытия:** 2026-09-18
- **Описание:**
  Ширина sidebar фиксирована (`--sidebar-width: 300px`). При длинных
  названиях комнат / диалогов / юзернеймов места не хватает,
  при широких экранах — много пустого места.
- **Решение:**
  Добавлен `.sidebar-resizer` между `#sidebar` и `#app-chat`.
  Drag мышью/тачем меняет `--sidebar-width` (220–600px).
  Ширина сохраняется в `localStorage` (`sidebar_width`).
  Двойной клик — сброс к 300px. На мобильных (≤768px) ресайз отключён.
- **Затронутые файлы:**
  - `index.html`
  - `src/styles/sidebar.css`
  - `src/app.js`
- **Связанные:** KI-003

<!-- Изменено в 6.2: добавлены KI-035…KI-051 по итогам аудита docs/development/reports/v6.2/audit-01-docs.md -->

## KI-035 — `/profile` падает: `initialsColorInput` vs `profileInitialsColor`

- **Приоритет:** 🟠 High
<!-- Изменено в 6.2: KI-035 исправлен — используется profileInitialsColor с guard -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-19
- **Дата закрытия:** 2026-10-19
- **Описание:**
  `ProfileModule.render()` присваивает
  `this.initialsColorInput = document.getElementById('initialsColorInput')`
  (строка 155), но шаблон создаёт `<input id="profileInitialsColor">`
  (строка 98). На строке 159 `this.initialsColorInput.value = color`
  бросает `TypeError: Cannot read properties of null`.
  `App.showProfile()` ловит ошибку (`src/app.js:504-517`), показывает toast
  «Не удалось загрузить профиль», страница `/profile` остаётся пустой.
  В коде используется `initialsColorInput`; в названии KI из задания —
  `initialColorInput`.
- **Решение:**
  В `src/modules/profile/ProfileModule.js` удалена ссылка на
  несуществующий `#initialsColorInput`. Цвет инициалов теперь
  устанавливается через существующий `this.initialsColor`
  (`#profileInitialsColor`) с guard:
  `if (this.initialsColor) this.initialsColor.value = color;`.
  Страница `/profile` больше не падает на `render()`.
- **Затронутые файлы:**
  - `src/modules/profile/ProfileModule.js` (98, 148, 155-160)
  - `src/app.js` (504-517)
  - `index.html` (684-695)
- **Связанные:** KI-031

---

## KI-036 — Тёмная тема без --btn-* в :root

- **Приоритет:** 🟠 High
<!-- Изменено в 6.2: KI-036 исправлен — полный набор --btn-* добавлен в :root -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-19
- **Дата закрытия:** 2026-10-19
- **Описание:**
  `KI-032` числился `Fixed`, но в `src/styles/main.css:2-23` (`:root`)
  переменных `--btn-*` нет. Они определены только для
  `[data-theme="light"]` (`src/styles/themes.css:23`) и
  `[data-theme="monokai"]` (`:64`). `.btn-primary` использует
  `var(--btn-primary-bg)` (`src/styles/main.css:629`), поэтому на дефолтной
  тёмной теме кнопки остаются без корректного фона.
- **Решение:**
  В `src/styles/main.css` в блок `:root` добавлены 16 переменных `--btn-*`:
  `border-radius`, `primary`, `secondary`, `danger`, `success`, `warning`
  (bg/hover/text). Теперь все три темы — dark (`:root`), light и monokai —
  содержат полный набор; `.btn-*` работает на дефолтной тёмной теме.
- **Затронутые файлы:**
  - `src/styles/main.css` (`:root`)
  - `src/styles/themes.css` (23, 64)
  - `docs/KNOWN_ISSUES.md` (KI-032)
- **Связанные:** KI-032

---

## KI-037 — Незакрытые code-fence в KNOWN_ISSUES.md (727, 793)

- **Приоритет:** 🟠 High
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  На момент аудита в `docs/KNOWN_ISSUES.md` было два открывающих fence:
  строка 727 (` ```css `) и строка 793 (` ```markdown `). Закрывающих
  не было, файл обрывался на строке 807. Весь хвост реестра от KI-032
  до шаблона рендерился как код.
  В фазе 1 fence закрыты; KI остаётся, чтобы регрессия не вернулась
  и чтобы проверка fence была автоматизирована.
- **План:**
  1. Добавить проверку парности fence в `tools/check-ki.ps1` или CI.
  2. При правках реестра проверять, что каждый ` ``` ` закрыт.
- **Затронутые файлы:**
  - `docs/KNOWN_ISSUES.md` (727, 745, 793, 807)
  - `tools/check-ki.ps1`
- **Связанные:** KI-046

---

## KI-038 — CONTRIBUTING.md обрезан (fence на строке 13)

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `CONTRIBUTING.md` — 23 строки. На строке 13 открывается
  ` ```markdown `, закрывающего fence нет; файл обрывается на шаблоне KI.
  Разделов о ветках, коммитах, PR и безопасности нет.
  В фазе 1 закрывающий fence добавлен, но содержимое всё ещё неполное.
- **План:**
  1. В следующей фазе слить `CONTRIBUTING.md` в `RULES.md`.
  2. Оставить короткий указатель на `docs/RULES.md`.
- **Затронутые файлы:**
  - `CONTRIBUTING.md` (13, 23)
- **Связанные:** нет

---

## KI-039 — Расхождение версий 6.1 / 6.2 / 6.2.0-dev

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-039 исправлен — версия v6.2 синхронизирована -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-19
- **Дата закрытия:** 2026-10-19
- **Описание:**
  Версия расходится по файлам:
  - `src/config.js:12` — `VERSION: '6.2'`;
  - `package.json:3` — `6.2.0-dev`;
  - `index.html:7`, `:37`, `:227`, `:433` — `v6.1`;
  - `locales/ru.js:4`, `locales/en.js:4` — `v6.1`;
  - `README.md:6` — «6.1 → в работе 6.2»;
  - `CHANGELOG.md:7` — `[Unreleased] — v6.2`.
- **Решение:**
  Версия v6.2 синхронизирована: `index.html` (title, copyright, header,
  wiki badge), `locales/ru.js:4`, `locales/en.js:4`, `README.md`.
  `src/config.js:12` уже содержал `6.2`; `package.json:3` оставлен
  `6.2.0-dev` как пререлизная версия пакета.
- **Затронутые файлы:**
  - `index.html`
  - `locales/ru.js`, `locales/en.js`
  - `README.md`
  - `CHANGELOG.md`
- **Связанные:** KI-040

---

## KI-040 — CHANGELOG.md противоречит реестру

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-040 исправлен — записи перенесены, путь и \ исправлены -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-19
- **Дата закрытия:** 2026-10-19
- **Описание:**
  `CHANGELOG.md:51-80` относит исправления KI-029, KI-031 и KI-032
  к релизу `[6.1]`, хотя реестр помечал их как `Fixed (v6.2)`.
  При этом KI-032 фактически не исправлен (см. KI-036), а KI-031
  закрыт частично. В `CHANGELOG.md:11` указан `docs/CONTRIBUTING.md`,
  но файл лежит в корне. В строке 70 — лишний `\`.
- **Решение:**
  В `CHANGELOG.md` записи KI-029, KI-031 и KI-032 перенесены из `[6.1]`
  в `[Unreleased] — v6.2`; путь `docs/CONTRIBUTING.md` заменён на
  `CONTRIBUTING.md`; лишний `\` удалён; добавлены записи KI-035 и KI-036.
- **Затронутые файлы:**
  - `CHANGELOG.md`
  - `CONTRIBUTING.md`
- **Связанные:** KI-039, KI-032

---

## KI-041 — npm test сломан: нет tools/run-tests.js

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  В `package.json:10` скрипт `test` вызывает
  `node tools/run-tests.js`, но файла `tools/run-tests.js` нет.
  Команда `npm test` гарантированно завершается ошибкой.
- **План:**
  1. Создать `tools/run-tests.js` или удалить скрипт.
  2. Связать с KI-011 (тесты i18n/NotificationManager/WorkspaceManager).
- **Затронутые файлы:**
  - `package.json` (10)
  - `tools/`
- **Связанные:** KI-011

---

## KI-042 — README.md битые ссылки, устаревшее дерево

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: KI-042 исправлен — README переписан, добавлен docs/README.md -->
- **Статус:** Fixed (v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-19
- **Дата закрытия:** 2026-10-19
- **Описание:**
  `README.md:132` ссылается на `docs/PROMPT_FOR_NEW_CHAT.md`, которого
  нет. Дерево `README.md:128-137` не отражает `docs/planning/`,
  `docs/development/`, `docs/archive/architecture`, `misc`, `structure`,
  `html-snapshots`. В шапке — версия 6.1. В фазе 1 закрыт только fence.
- **Решение:**
  `README.md` переписан: дерево проекта отражает `docs/`, `docs/archive/`,
  `docs/development/`, `docs/planning/`, `src/`, `locales/`, `tests/`,
  `tools/`, `vendor/`; ссылки ведут только на существующие файлы.
  Создан `docs/README.md` — хаб документации по ролям.
- **Затронутые файлы:**
  - `README.md`
  - `docs/README.md`
- **Связанные:** KI-026, KI-038

---

## KI-043 — PROJECT_OVERVIEW.md устарел (v5.0)

- **Приоритет:** 🟡 Medium
<!-- Изменено в 6.2: создан GUIDE.md/ARCHITECTURE.md; KI-043 остаётся Open, т.к. PROJECT_OVERVIEW.md не переписан -->
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `docs/PROJECT_OVERVIEW.md` — plain text без Markdown-заголовков.
  Версия 5.0 (`:413`), порт по умолчанию 1234 (`:5`) вместо 8034,
  «23 достижения» (`:197`) вместо `CONFIG.ACHIEVEMENTS.TOTAL = 20`.
  Нет приватных чатов, админки, SPA-роутинга и модулей 6.x.
  Фундамент документации (GUIDE, ARCHITECTURE, PROMPT_CURRENT) создан,
  но `PROJECT_OVERVIEW.md` ещё не переписан.
- **План:**
  1. Слить актуальные части в `README.md`/`docs/user-guide/GUIDE.md`.
  2. `GUIDE.md` и `ARCHITECTURE.md` созданы (Фаза 4); `PROJECT_OVERVIEW.md`
     ещё не переписан.
  3. Старую версию — в `docs/archive/` после переноса.
- **Затронутые файлы:**
  - `docs/PROJECT_OVERVIEW.md` (5, 197, 413)
- **Связанные:** KI-042

---

## KI-044 — Промпт v6.0→6.1 устарел

- **Приоритет:** 🟢 Low
<!-- Изменено в 6.2: создан PROMPT_CURRENT.md; старый промпт ещё не архивирован, KI-044 остаётся Open -->
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `docs/Промпт для нового чата (… v6.0 → v6.1).txt` описывает версию 6.0
  (`:4`), указывает `ChatModule` как обёртку над `ChatView` и `Sidebar`
  (`:36`), содержит `locales/ru.json`/`en.json` (`:98`), не упоминает
  SettingsModule и StatsModule. Новый `docs/development/PROMPT_CURRENT.md`
  создан, но старый файл ещё не перемещён в архив.
- **План:**
  1. Архивировать старый промпт.
  2. `docs/development/PROMPT_CURRENT.md` создан (Фаза 4); осталось
     убрать старый файл из корня `docs/`.
- **Затронутые файлы:**
  - `docs/Промпт для нового чата (продолжение разработки Infocom LM Chat Pro v6.0 → v6.1).txt` (4, 36, 98)
- **Связанные:** KI-043

---

## KI-045 — API.md — plain text, не Markdown

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `docs/API.md` — 725 строк plain text с ASCII-рамками и шапкой v5.1
  (`:1-19`). Заголовков Markdown нет, таблиц нет, документ неудобно
  читать на GitHub и сложно поддерживать.
- **План:**
  1. Конвертировать в Markdown (заголовки, таблицы, code-fence).
  2. Сверить эндпоинты с `src/services/http-client.js`.
  3. Обновить версию до 6.2.
- **Затронутые файлы:**
  - `docs/API.md` (1-19)
- **Связанные:** нет

---

## KI-046 — check-ki.ps1 считает шаблон как статус

- **Приоритет:** 🟡 Medium
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `tools/check-ki.ps1` (untracked) считал строку шаблона
  `**Статус:** Open / In Progress / …` как отдельный `Open`:
  получалось 12 Open и сумма 34 при 33 заголовках. Скрипт также ожидал
  поле «Исправлено в», которого не было у Fixed-записей.
  В фазе 1 шаблон переведён на значения в backticks, якорь проверки
  исправлен; KI остаётся для автоматизации в CI.
- **План:**
  1. Держать шаблон в виде `одно из \`Open\` / …`.
  2. Проверять, что сумма статусов равна числу заголовков.
  3. Добавить скрипт в git и CI.
- **Затронутые файлы:**
  - `tools/check-ki.ps1` (42-43, 109-122)
  - `docs/KNOWN_ISSUES.md` (797)
- **Связанные:** KI-037

---

## KI-047 — Пропуск KI-024 (Documented)

- **Приоритет:** 🟢 Low
- **Статус:** Documented
- **Дата открытия:** 2026-10-19
- **Описание:**
  Нумерация KI идёт `KI-023` → `KI-025`; записи `KI-024` нет.
  Это не потеря файла, а исторический пропуск. Нумерация не
  восстанавливается, чтобы не менять существующие ID и ссылки.
- **План:**
  1. Оставить пропуск.
  2. Указывать его в сводке реестра.
  3. Не заполнять задним числом.
- **Затронутые файлы:**
  - `docs/KNOWN_ISSUES.md`
- **Связанные:** нет

---

## KI-048 — AI-артефакты в app.js:549-556, 1873-1886

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  В классе `App` остались комментарии вида «остальные методы… не дублирую»,
  «в этом ответе привожу только изменённые части» (`src/app.js:549-556`,
  `1873-1886`). Они не влияют на работу, но вводят в заблуждение:
  методы в файле есть, а комментарии утверждают обратное.
- **План:**
  1. Проверить, что перечисленные методы действительно определены.
  2. Удалить комментарии отдельным PR.
- **Затронутые файлы:**
  - `src/app.js` (549-556, 1873-1886)
- **Связанные:** нет

---

## KI-049 — Fallback 'local-model' в sidebar.js:108

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `src/ui/views/sidebar.js:108` использует
  `session.model || 'local-model'`. KI-029 исправил `defaultModel`
  в `SessionManager`, но fallback для бейджа остался: при пустом
  `session.model` пользователь снова увидит «local-model».
- **План:**
  1. Заменить на `CONFIG.UI_CONFIG.DEFAULT_MODEL` или `app.currentModel`.
  2. Проверить бейдж на новой и старой сессии.
- **Затронутые файлы:**
  - `src/ui/views/sidebar.js` (108)
- **Связанные:** KI-029

---

## KI-050 — Комментарии ПРОБЛЕМА… в sanitizer.js

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  В `src/services/sanitizer.js` 16 комментариев «ПРОБЛЕМА…»
  (`:8-9`, `:16`, `:22-24`, `:31`, `:41`, `:63`, `:72-73`, `:86`,
  `:113-114`, `:138`, `:154`). Часть соседствует с «Исправлено»;
  файл читается как незавершённое ревью, а не продакшн-код.
- **План:**
  1. Убрать комментарии или перенести в задачу/тест.
  2. Не менять поведение санитайзера без тестов.
- **Затронутые файлы:**
  - `src/services/sanitizer.js` (8-9, 16, 22-24, 31, 41, 63, 72-73, 86, 113-114, 138, 154)
- **Связанные:** нет

---

## KI-051 — project-inventory.txt устарел

- **Приоритет:** 🟢 Low
- **Статус:** Open
- **Дата открытия:** 2026-10-19
- **Описание:**
  `project-inventory.txt` — снимок от 2026-09-17 (`:5`), 195 файлов.
  Он ссылается на удалённые файлы (например, `docs/Infocom_API_Reference.txt`,
  `docs/miniMetro_documentation.md`) и не отражает текущую структуру.
- **План:**
  1. Перегенерировать `tools/inventory.ps1` или архивировать файл.
  2. Не держать устаревший снимок в корне.
- **Затронутые файлы:**
  - `project-inventory.txt` (5, 53)
- **Связанные:** KI-022

---

## KI-052 — Переход на монорепозиторий

- **Приоритет:** 🟡 Medium
- **Статус:** Fixed (в v6.2)
- **Исправлено в:** v6.2
- **Дата открытия:** 2026-10-20
- **Дата закрытия:** 2026-10-20
- **Описание:**
  Клиент и сервер жили раздельно: SPA лежал в корне репозитория, а
  .NET Core API — вне его. Пути в документации и скриптах запуска
  (`index.html`, `src/`, `web.config`, статика) перестали быть
  однозначными, а инвентаризация не видела серверную часть.
- **Решение:**
  1. Клиент перенесён в `client/`: `index.html`, `src/`, `locales/`,
     `tests/`, `vendor/`, `package.json`, `web.config`.
  2. Сервер (.NET Core Web API) скопирован в `server/`:
     `ProjectManager.API.sln`, `ProjectManager.API.csproj`,
     `Controllers/`, `Services/`, `Data/`, `Migrations/`.
  3. В корне остались `docs/`, `tools/`, `README.md`, `.gitignore`.
  4. Обновлены пути в `README.md`, `docs/development/ARCHITECTURE.md`,
     `docs/development/PROMPT_CURRENT.md` и скриптах `tools/scripts/`.
  5. `tools/inventory.ps1` сканирует обе папки и игнорирует
     `server/bin`, `server/obj`.
- **Затронутые файлы:**
  - `README.md`
  - `docs/development/ARCHITECTURE.md`
  - `docs/development/PROMPT_CURRENT.md`
  - `tools/scripts/start-python.sh`
  - `tools/scripts/start-live-server.sh`
  - `tools/inventory.ps1`
  - `.gitignore` (правила для `server/bin`, `server/obj`)
- **Связанные:** KI-042, KI-043, KI-044, KI-051

---

## Шаблон для новой записи

```markdown
## KI-XXX — Краткое название

- **Приоритет:** 🔴/🟠/🟡/🟢
- **Статус:** одно из `Open` / `In Progress` / `Fixed` / `Documented` / `Deferred` / `Won't Fix`
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
```
<!-- Изменено в 6.2: закрыт code-fence шаблона (KI-037) -->

<!-- Добавлено в 6.2: сводка на 2026-10-19 -->
<!-- Изменено в 6.2: сводка обновлена после закрытия KI-026/032/035/036/039/040/042 -->
<!-- Изменено в 6.2: добавлен KI-052 (монорепозиторий), всего 51 -->
<!-- Изменено в 6.2: KI-025 исправлен (offline-mode) -->
## Сводка

- Всего KI: 51
- Fixed: 26 (включая KI-031 Fixed (Partial))
- Open: 17
- In Progress: 2
- Documented: 4
- Deferred: 1
- Won't Fix: 1
- Пропущенные: KI-024 (Documented — KI-047)

Сумма статусов: 26 + 17 + 2 + 4 + 1 + 1 = 51. Совпадает с числом заголовков.

Примечание: `KI-024` — пропуск в нумерации, а не отдельный заголовок;
он задокументирован в KI-047. KI-052 добавлен при переходе на
монорепозиторий (`client/` + `server/`); KI-025 закрыт офлайн-режимом.
