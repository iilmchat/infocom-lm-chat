# Аудит документации Infocom LM Chat Pro v6.2

- **Дата:** 2026-10-19
- **Репозиторий:** `D:\Projects\infocom-lm-chat`
- **HEAD:** `0a69031` (`main`, после PR #2)
- **Режим:** READ-ONLY
- **Статус снимка:** до синхронизации реестра (фаза 1). После фазы 1 в реестре 50 KI; см. `docs/KNOWN_ISSUES.md`.

> Отчёт фиксирует состояние на момент аудита. Нумерация новых проблем — `KI-NEW-01…17`; при регистрации в фазе 1 они получили ID `KI-035…KI-051`.

---

## 1. Метрики

### 1.1. Сводка реестра (на момент аудита)

Всего заголовков `## KI-XXX` — **33**. ID идут от `KI-001` до `KI-034`, при этом **`KI-024` отсутствует**.

| Статус | Кол-во | ID |
|---|---:|---|
| `Fixed` | 11 | KI-001, 003, 004, 010, 013, 014, 027, 031, 032, 033, 034 |
| `Open` | 11 | KI-002, 005, 006, 011, 015, 017, 020, 025, 026, 028, 029 |
| `In Progress` | 8 | KI-007, 012, 016, 018, 019, 021, 022, 023 |
| `Deferred` | 1 | KI-008 |
| `Documented` | 1 | KI-009 |
| `Won't Fix` | 1 | KI-030 |
| **Итого** | **33** | |

**Сумма статусов:** `11 + 11 + 8 + 1 + 1 + 1 = 33` — **арифметически сходится**.

**Семантически — нет:**
- 12 записей имеют статус, противоречащий коду/документации;
- ещё 3 записи требуют уточнения статуса;
- `KI-031` закрыт частично;
- отсутствует `KI-024`;
- штатный чекер `tools/check-ki.ps1` давал **Open = 12, сумма = 34**, потому что захватывал строку шаблона `**Статус:** Open / In Progress...` (`docs/KNOWN_ISSUES.md:797`). Это дефект чекера, а не реестра.

**Приоритеты:**

| Приоритет | Кол-во | ID |
|---|---:|---|
| 🔴 Critical | 3 | KI-001, 003, 031 |
| 🟠 High | 9 | KI-002, 004, 005, 013, 025, 027, 029, 032, 033 |
| 🟡 Medium | 11 | KI-006, 007, 011, 012, 015, 016, 017, 018, 020, 023, 028 |
| 🟢 Low | 10 | KI-008, 009, 010, 014, 019, 021, 022, 026, 030, 034 |

### 1.2. Полный вердикт по 33 KI

| KI | Приоритет | Статус | Проверка по коду/докам | Вердикт |
|---|---|---|---|---|
| KI-001 | 🔴 | Fixed | `src/services/i18n.js:5-6` — импорты `.js` без `assert` | ✅ подтверждён |
| KI-002 | 🟠 | Open | `locales/en.js:7-30` — русский текст | ⚠️ актуален |
| KI-003 | 🔴 | Fixed | `index.html:41`, `index.html:186`, `src/app.js:172` | ✅ подтверждён |
| KI-004 | 🟠 | Fixed | `src/models/notification-manager.js:63` — `addNotification` | ✅ подтверждён |
| KI-005 | 🟠 | Open | `src/models/multi-user-manager.js:103-106`, `:760`, `src/ui/views/admin-panel.js:779`; `normalizeUser` нет | ⚠️ актуален |
| KI-006 | 🟡 | Open | `src/modules/stats/StatsModule.js:125-145` — заглушка | ⚠️ актуален |
| KI-007 | 🟡 | In Progress | `src/app.js:99` — только импорт; вызовов `i18n.t` — 0 | ⚠️ актуален |
| KI-008 | 🟢 | Deferred | `src/models/multi-user-manager.js:1269-1296` — методы есть | ✅ корректен |
| KI-009 | 🟢 | Documented | `src/models/multi-user-manager.js:412-413`, `:1539-1540`, `src/app.js:652` | ✅ корректен |
| KI-010 | 🟢 | Fixed | Промпт всё ещё содержит `locales/ru.json` — `docs/Промпт…:98` | 🧟 fixed без правки |
| KI-011 | 🟡 | Open | `tests/` — только 2 файла; нужных тестов нет | ⚠️ актуален |
| KI-012 | 🟡 | In Progress | `src/modules/private/PrivateChatModule.js:646-650`; остальные `?.` оставлены осознанно | ⚠️ уточнить |
| KI-013 | 🟠 | Fixed | `src/modules/chat/ChatModule.js:26`, `src/app.js:172` | ✅ подтверждён |
| KI-014 | 🟢 | Fixed | Только архив `docs/archive/snapshots/04_services.txt:205-206`; код не менялся | 🧟 paper-only |
| KI-015 | 🟡 | Open | `LICENSE`, `README.md`, `.gitignore` существуют | 🧟 уже сделано |
| KI-016 | 🟡 | In Progress | `docs/archive/legacy/syntax-highlighter/` — 6 файлов; в `src/` нет | 🧟 уже сделано |
| KI-017 | 🟡 | Open | `vendor/` + `index.html:21-30`; `src/components` нет | 🧟 уже сделано |
| KI-018 | 🟡 | In Progress | `docs/archive/legacy/modals/`, `models/`; дублей в `src/` нет | 🧟 уже сделано |
| KI-019 | 🟢 | In Progress | `docs/archive/mini-metro/` — 19 файлов; `src/games/mini-metro_old*` нет | 🧟 уже сделано |
| KI-020 | 🟡 | Open | `docs/archive/` есть, но в корне `docs/` остались 2 `.txt` | ⚠️ частично |
| KI-021 | 🟢 | In Progress | `docs/archive/html-snapshots/Infocom LM Chat.html` | 🧟 уже сделано |
| KI-022 | 🟢 | In Progress | `tools/build-archive.mjs`, `tools/archive/`, `tools/scripts/`; корень чист | 🧟 уже сделано |
| KI-023 | 🟡 | In Progress | `web.config:13` rewrite, `:54` SAMEORIGIN, `:65-68` fallback | ⚠️ нужен деплой-тест |
| KI-024 | — | — | Заголовка нет, ID пропущен | ❌ пропуск |
| KI-025 | 🟠 | Open | `offlineMode`/`pingBackend` не найдены; fetch в RoomList/MultiUser/Auth | ⚠️ актуален |
| KI-026 | 🟢 | Open | `README.md:51` — незакрытый fence; заголовки/таблицы потеряны | ⚠️ актуален |
| KI-027 | 🟠 | Fixed | `src/modules/private/PrivateChatModule.js:42-43`, `:407-439` | ✅ подтверждён |
| KI-028 | 🟡 | Open | `src/modules/private/PrivateChatModule.js:650` уже `.id`; `src/models/multi-user-manager.js:103-106` нормализует | 🧟 уже сделано |
| KI-029 | 🟠 | Open | `src/models/session-manager.js:31-32`, `:467`, `:638-647`, `src/app.js:624-626` | 🧟 уже сделано |
| KI-030 | 🟢 | Won't Fix | Внешний API не используется | ✅ корректен |
| KI-031 | 🔴 | Fixed | `src/ui/views/profile-modal.js:124-150` — guards; `:386` — без guard | ⚠️ частично |
| KI-032 | 🟠 | Fixed | `src/styles/main.css:2-23` — btn vars нет; `src/styles/themes.css:23`, `:64` — только light/monokai | 🧟 fixed без кода |
| KI-033 | 🟠 | Fixed | `src/app.js:1857-1872`; `show*` — `:413`, `:422`, `:438`, `:445`, `:467`, `:486`, `:505` | ✅ подтверждён |
| KI-034 | 🟢 | Fixed | `src/app.js:172-173`, `:322`; `src/styles/sidebar.css:725-757`; `index.html:181` | ✅ подтверждён |

### 1.3. Итог по «зомби»

**Явные зомби — 12 записей:**

| Тип | KI | Суть |
|---|---|---|
| Fixed, но код/док не изменён | KI-010, KI-014, KI-032 | KI-010 — промпт всё ещё `.json`; KI-014 — только запись в архиве; KI-032 — btn-переменных в `:root` нет |
| Open/In Progress, но работа выполнена | KI-015, KI-016, KI-017, KI-018, KI-019, KI-021, KI-022, KI-028, KI-029 | файлы уже перенесены/созданы; код уже исправлен |

**Требуют уточнения — 3 записи:**
- `KI-031` — исходный краш `setMode('login')` исправлен, но остался незащищённый доступ в строке 386; плюс найден новый краш `ProfileModule`;
- `KI-020` — структура `docs/` в основном разложена, но 2 `.txt` остались в корне;
- `KI-012` — по сути выполнено, но корректнее `Documented`/`Deferred`, а не `In Progress`.

**Формальная проверка Fixed:**
- 11/11 записей содержат ссылку на файл/метод — **формально зомби-фиксов по критерию «нет ссылки» нет**;
- 7/11 подтверждены кодом;
- 1/11 частично (`KI-031`);
- 3/11 не подтверждены (`KI-010`, `KI-014`, `KI-032`).

### 1.4. Open Critical/High: воспроизводимость

| KI | Приоритет | Воспроизводится? | Детали |
|---|---|---|---|
| KI-002 | 🟠 High | **Да** | `locales/en.js` полностью русский |
| KI-005 | 🟠 High | **Да** | `Id`/`id` смешаны, `normalizeUser()` отсутствует |
| KI-025 | 🟠 High | **Да** | `offlineMode`/`pingBackend` нет; запросы к 8032 падают |
| KI-029 | 🟠 High | **Нет** | Код уже исправлен: `defaultModel` из `CONFIG`, синхронизация в `app.js` |
| KI-032 | 🟠 High (фактически) | **Да** | Числится `Fixed`, но btn-переменных в тёмной теме нет |

**Critical Open:** нет. Все 3 Critical числятся `Fixed`, но `KI-031` — частично.

---

## 2. Структура `docs/`

### 2.1. Текущее состояние

Всего **76 файлов**: **69** в `docs/archive/`, **7** активных.

| Зона | Файлов |
|---|---:|
| `docs/` (корень) | 5 |
| `docs/planning/` | 2 |
| `docs/archive/` | 69 |
| **Итого** | **76** |

### 2.2. Целевая структура (предложение)

```text
docs/
├── README.md                     # индекс docs/
├── RULES.md                      # новый
├── PROMPT_CURRENT.md             # новый
├── ARCHITECTURE.md               # новый, вместо «Общая архитектура.txt»
├── KNOWN_ISSUES.md               # реестр KI
├── API.md                        # REST API, переписать в Markdown
├── development/
│   ├── reports/
│   │   ├── README.md
│   │   └── v6.2/
│   │       └── audit-01-docs.md  # этот отчёт
│   └── templates/
│       ├── KI_TEMPLATE.md
│       └── REPORT_TEMPLATE.md
├── planning/
│   ├── ROADMAP.md
│   └── MINIMETRO_SPEC.md
├── user-guide/
│   └── GUIDE.md                  # из PROJECT_OVERVIEW.md
└── archive/                      # без изменений: 69 файлов
```

### 2.3. Активные файлы: рекомендации

| Файл | Сейчас | Рекомендация |
|---|---|---|
| `docs/Общая архитектура.txt` | Plain text, v5.x, SignalR, `222.1.1.31:8034` | **Архивировать** в `docs/archive/architecture/`; создать `docs/ARCHITECTURE.md` |
| `docs/Промпт для нового чата…v6.0 → v6.1.txt` | Устаревший промпт: `.json`, `ChatModule` + `Sidebar` | **Архивировать**; заменить `docs/PROMPT_CURRENT.md` |
| `docs/API.md` | Plain text ASCII, шапка v5.1, 725 строк | **Оставить**, переписать в Markdown и обновить до v6.2 |
| `docs/KNOWN_ISSUES.md` | 33 KI, 2 незакрытых fence, 12 зомби-статусов | **Оставить**, починить разметку и статусы |
| `docs/PROJECT_OVERVIEW.md` | Plain text, v5.0, порт 1234, 23 достижения | **Слить** с `README.md`/`docs/user-guide/GUIDE.md`; старую версию — в архив |
| `docs/planning/ROADMAP.md` | Plain text, v6.1, 221 строка | **Оставить**, конвертировать в Markdown, обновить |
| `docs/planning/MINIMETRO_SPEC.md` | Plain text, 160 строк | **Оставить**, конвертировать в Markdown |
| `docs/archive/**` | 69 файлов | **Оставить без изменений** (археология) |
| `README.md` | 259 строк, fence с строки 51, 8 из 9 разделов потеряли заголовки | **Переписать с нуля** |
| `CHANGELOG.md` | Формально ок, но противоречит реестру | **Оставить**, исправить атрибуцию KI |
| `CONTRIBUTING.md` | 23 строки, незакрытый fence, обрыв | **Слить** с `RULES.md`; оставить короткий указатель |
| `project-inventory.txt` | Снимок от 2026-09-17, ссылается на удалённые файлы | **Архивировать** или перегенерировать |
| `tools/check-ki.ps1` | Untracked, требует `-ExecutionPolicy Bypass`, ложный Open=12 | **Добавить в git**, исправить логику |

### 2.4. README и Markdown

**README.md:**
- 259 строк; единственный fence — `README.md:51` (` ```bash `), закрывающего нет: всё с 51-й строки до конца файла — код.
- После строки 49 сохранился только один заголовок `### 1. Клонирование`; разделы 2–9 потеряли `##`.
- Таблицы «Горячие клавиши» (`README.md:225`) и «Известные проблемы» (`:239`) — табы вместо `|`.
- Ссылка на `docs/PROMPT_FOR_NEW_CHAT.md` (`README.md:132`) — файла нет.
- Дерево не отражает `docs/planning/`, `docs/development/`, `docs/archive/architecture`, `misc`, `structure`, `html-snapshots`.
- Версия в шапке — 6.1 (`README.md:6`), хотя `config.js` уже 6.2.

**Вердикт:** переписать с нуля, а не латать.

**CONTRIBUTING.md:**
- 23 строки, один fence `CONTRIBUTING.md:13` (` ```markdown `), закрытия нет.
- Файл обрывается на шаблоне KI; разделов о ветках, коммитах, PR и безопасности нет.
- `CHANGELOG.md` ссылается на `docs/CONTRIBUTING.md`, но файл лежит в корне.

**KNOWN_ISSUES.md:**
- Два открывающих fence: `727` (` ```css `) и `793` (` ```markdown `); ни одного закрывающего — файл заканчивается на строке 807 без ` ``` `.
- Из-за этого весь хвост от KI-032 до шаблона рендерится как код.
- В `KI-032` приведён код `:root` с btn-переменными, которого нет в `main.css`.
- `KI-024` отсутствует; `KI-031` содержит заглушку `... (оставить как было)`.

**Остальные Markdown:**

| Файл | Проблема |
|---|---|
| `CHANGELOG.md` | KI-029/031/032 отнесены к `[6.1]`, хотя реестр говорит v6.2; строка 70 — лишний `\`; `docs/CONTRIBUTING.md` — неверный путь |
| `docs/API.md` | Не Markdown: ASCII-рамки, нет заголовков; шапка v5.1 |
| `docs/PROJECT_OVERVIEW.md` | Не Markdown: plain text, v5.0, порт 1234, 23 достижения |
| `docs/planning/ROADMAP.md` | Plain text, v6.1, без заголовков Markdown |
| `docs/planning/MINIMETRO_SPEC.md` | Plain text, без заголовков Markdown |

### 2.5. `docs/archive/` — полный список (69 файлов, «оставить»)

- **`archive/architecture/` (6):** `after-changes.txt`, `modules.txt`, `ports.txt`, `private-chats.txt`, `structure-full.txt`, `structure.txt`.
- **`archive/html-snapshots/` (1):** `Infocom LM Chat.html`.
- **`archive/legacy/` (15):** `CodeEditor.jsx`, `test-runner_Old.js`, `modals/auth-modal.js`, `modals/user-modal.js`, `models/ses.js`, `network-helpers/network-helpers_new.js`, `network-helpers_new.js.txt`, `network-helpers_old.js`, `network-helpers.js.txt`, `syntax-highlighter/cache.js`, `main.js`, `optimizations.js`, `syntax-highlighter.js`, `useSyntaxHighlight.js`, `worker.js`.
- **`archive/mini-metro/` (19):** `algorithms.txt`, `integration-v6.1.txt`, `notes.txt`, `sprint-7-changes.txt`, `sprint-8-summary.txt`, `train-movement-fix.txt`, `MiniMetro_src_games_2mini-metro.js` … `MiniMetro_src_games_12mini-metro.js`, `MiniMetro_src_games_9спринт_mini-metro.js`, `MiniMetro_src_games_mini-metro.js`.
- **`archive/misc/` (8):** `client-open.txt`, `copy-to-clipboard.txt`, `drag-and-drop.txt`, `es-module.html`, `html-example.html`, `rag.txt`, `regular-script.html`, `send-message.txt`.
- **`archive/planning/` (1):** `general-todo.txt`.
- **`archive/snapshots/` (5):** `01_core.txt`, `02_modules.txt`, `03_ui_styles.txt`, `04_services.txt`, `05_models.txt`.
- **`archive/structure/` (3):** `structure_full.txt`, `structure_old.txt`, `structure.txt`.
- **`archive/v5.2/` (6):** `api-service.txt`, `chat-view.txt`, `get-messages-with-highlight.txt`, `session-manager.txt`, `summary.txt`, `syntax-highlighter-removal.txt`.
- **`archive/v5.3/` (3):** `integration.txt`, `ready-for-v5.3.txt`, `section-toggle.txt`.
- **`archive/v6.x/` (2):** `changes-13.txt`, `summary-13.txt`.

**Итого:** 6 + 1 + 15 + 19 + 8 + 1 + 5 + 3 + 6 + 3 + 2 = **69**.

---

## 3. Smoke Critical/High KI ↔ код

Проверка статическая, по текущему коду; браузерный прогон не выполнялся.

| KI | Приоритет / статус | Есть фикс/проблема в коде? | Файл:строка | Вердикт |
|---|---|---|---|---|
| KI-001 | 🔴 Fixed | **Да** | `src/services/i18n.js:5-6` | Подтверждён |
| KI-003 | 🔴 Fixed | **Да** | `index.html:41`, `:186`; `src/app.js:172` | Подтверждён |
| KI-031 | 🔴 Fixed | **Частично** | `src/ui/views/profile-modal.js:124-150`; `:386` | Исходный краш исправлен; остался unguarded-доступ + новый краш `ProfileModule` |
| KI-002 | 🟠 Open | **Нет** (проблема) | `locales/en.js:7-30` | Воспроизводится |
| KI-004 | 🟠 Fixed | **Да** | `src/models/notification-manager.js:63` | Подтверждён |
| KI-005 | 🟠 Open | **Нет** | `src/models/multi-user-manager.js:103-106`, `:760`; `src/ui/views/admin-panel.js:779` | Воспроизводится |
| KI-013 | 🟠 Fixed | **Да** | `src/modules/chat/ChatModule.js:26`; `src/app.js:172` | Подтверждён |
| KI-025 | 🟠 Open | **Нет** | `offlineMode`/`pingBackend` отсутствуют; fetch в RoomList/MultiUser/Auth | Воспроизводится |
| KI-027 | 🟠 Fixed | **Да** | `src/modules/private/PrivateChatModule.js:42-43`, `:407-439` | Подтверждён |
| KI-029 | 🟠 Open | **Да** (фикс есть) | `src/models/session-manager.js:31-32`, `:467`, `:638-647`; `src/app.js:624-626` | Не воспроизводится; статус устарел |
| KI-032 | 🟠 Fixed | **Нет** | `src/styles/main.css:2-23`; `src/styles/themes.css:23`, `:64` | Не исправлен; зомби-фикс |
| KI-033 | 🟠 Fixed | **Да** | `src/app.js:1857-1872` | Подтверждён |

**Вывод:** из 12 Critical/High-записей 7 подтверждены, 1 частично, 2 не подтверждены (`KI-029` — наоборот, уже исправлен; `KI-032` — не исправлен), 2 Open воспроизводятся (`KI-002`, `KI-005`), `KI-025` воспроизводится.

---

## 4. Новые KI

При регистрации в фазе 1 получили ID `KI-035…KI-051`.

| ID | Приоритет | Проблема | Файлы/строки |
|---|---|---|---|
| **KI-NEW-01** → KI-035 | 🟠 High | `/profile` падает: `ProfileModule` ищет `initialsColorInput`, а шаблон создаёт `profileInitialsColor`; `this.initialsColorInput.value` → `TypeError`. `showProfile` ловит ошибку, показывает toast, страница остаётся пустой. | `src/modules/profile/ProfileModule.js:98,155,159`; `src/app.js:504-517`; `index.html:684-695` |
| **KI-NEW-02** → KI-036 | 🟠 High | `KI-032` помечен `Fixed`, но в `:root` нет btn-переменных; тёмная тема остаётся без корректных цветов кнопок. | `src/styles/main.css:2-23,629`; `src/styles/themes.css:23,64`; `docs/KNOWN_ISSUES.md:727-745` |
| **KI-NEW-03** → KI-037 | 🟠 High | В `KNOWN_ISSUES.md` два незакрытых fence (727 и 793), файл кончается без закрывающего ` ``` ` — хвост реестра рендерится как код. | `docs/KNOWN_ISSUES.md:727,793,807` |
| **KI-NEW-04** → KI-038 | 🟡 Medium | `CONTRIBUTING.md` обрезан: один fence на строке 13, файл кончается на 23-й без закрытия и без разделов о ветках/PR. | `CONTRIBUTING.md:13` |
| **KI-NEW-05** → KI-039 | 🟡 Medium | Расхождение версий: `config.js` — 6.2, `package.json` — 6.2.0-dev, `index.html`/локали — 6.1. | `src/config.js:12`; `package.json:3`; `index.html:7,227,433`; `locales/en.js:4`; `locales/ru.js:4` |
| **KI-NEW-06** → KI-040 | 🟡 Medium | `CHANGELOG` противоречит реестру: KI-029/031/032 под `[6.1]`, реестр — v6.2; KI-032 вообще не исправлен; `docs/CONTRIBUTING.md` не существует; лишний `\`. | `CHANGELOG.md:11,51-80,70` |
| **KI-NEW-07** → KI-041 | 🟡 Medium | `npm test` не работает: `tools/run-tests.js` отсутствует. | `package.json:10` |
| **KI-NEW-08** → KI-042 | 🟡 Medium | README ссылается на несуществующий `docs/PROMPT_FOR_NEW_CHAT.md`; дерево не отражает `docs/planning`, `docs/development`, часть архива. | `README.md:132,128-137` |
| **KI-NEW-09** → KI-043 | 🟡 Medium | `PROJECT_OVERVIEW.md` — plain text v5.0, порт 1234, 23 достижения (в `CONFIG` — 20), нет 6.x-функций. | `docs/PROJECT_OVERVIEW.md:5,197,413` |
| **KI-NEW-10** → KI-044 | 🟢 Low | Промпт v6.0→6.1 устарел: `.json`-локали, `ChatModule` + `Sidebar`, нет Settings/Stats. | `docs/Промпт…:4,36,98` |
| **KI-NEW-11** → KI-045 | 🟢 Low | `API.md` — plain text ASCII, шапка v5.1; не Markdown. | `docs/API.md:1-19` |
| **KI-NEW-12** → KI-046 | 🟡 Medium | `tools/check-ki.ps1` untracked, требует `-ExecutionPolicy Bypass`, считает строку шаблона как Open (34 vs 33), ожидает `**Исправлено в:**`, которого в реестре нет. | `tools/check-ki.ps1:42-43,109-122`; `docs/KNOWN_ISSUES.md:797` |
| **KI-NEW-13** → KI-047 | 🟢 Low | Пропуск `KI-024`: 33 записи, но ID до 034; счётчики «34 KI» будут ошибочны. | `docs/KNOWN_ISSUES.md` |
| **KI-NEW-14** → KI-048 | 🟢 Low | В `app.js` остались следы AI-ответа: «остальные методы… не дублирую», «в этом ответе привожу только изменённые части». | `src/app.js:549-556,1873-1886` |
| **KI-NEW-15** → KI-049 | 🟢 Low | В `sidebar.js` сохранён жёсткий fallback `'local-model'`, хотя KI-029 исправлен. | `src/ui/views/sidebar.js:108` |
| **KI-NEW-16** → KI-050 | 🟢 Low | В `sanitizer.js` 16 комментариев «ПРОБЛЕМА…», противоречащих «Исправлено»; код выглядит как незавершённое ревью. | `src/services/sanitizer.js:8-9,16,22-24,72-73` |
| **KI-NEW-17** → KI-051 | 🟢 Low | `project-inventory.txt` — устаревший снимок (2026-09-17), ссылается на удалённые файлы. | `project-inventory.txt:5,53` |

---

## 5. `RULES.md` (черновик)

```markdown
# RULES.md — Infocom LM Chat Pro

Версия: 1.0 (черновик, v6.2)
Статус: proposed
Область: весь репозиторий, кроме docs/archive/legacy/.
Приоритет: RULES.md > CONTRIBUTING.md > устные договорённости.

## 1. Код

1.1. Только ES-модули и vanilla JS. Новые файлы — в слой по назначению:
     core, services, models, modules, ui, utils. Не складывать всё в app.js.
1.2. Стиль: 4 пробела, одинарные кавычки, точка с запятой, camelCase для
     переменных/методов, PascalCase для классов.
1.3. Каждое изменение помечать комментарием версии:
     /* Добавлено в 6.2 */, /* Изменено в 6.2: ... (KI-XXX) */,
     /* Удалено в 6.2: ... */. Комментарий — над изменённым блоком.
1.4. Не удалять код молча. Удаление — с записью в CHANGELOG и, если это
     ломает поведение, с KI.
1.5. В продакшн-коде (src/) запрещён console.log. Для диагностики —
     console.warn/console.error, ErrorBoundary или toast. Временный
     console.log допустим только с TODO и должен быть удалён до merge.
1.6. Запрещены «заглушки-обещания» и следы AI-ответов в коде:
     комментарии вида «остальные методы не дублирую», «для краткости
     пропускаю» и т.п.
1.7. Бизнес-логика — в менеджерах/сервисах, UI только отображает и
     делегирует. Не дублировать расчёты в видах.
1.8. Новый SPA-раздел подключается через Router и модуль, а не прямым
     созданием в App.
1.9. Любой document.getElementById(...) в модуле — с проверкой на null
     или ?.; ID в шаблоне и в JS должны совпадать. Правило появилось
     после KI-035/KI-031.
1.10. Перед PR: открыть затронутые страницы, проверить консоль,
      переключить тему, прогнать доступные тесты.

## 2. Коммиты

2.1. Conventional Commits: <type>(<scope>): <summary>.
     Пример: fix(private): убрать спам уведомлений (KI-027).
2.2. Разрешённые типы: feat, fix, docs, refactor, chore, test, perf, style.
2.3. Scope — модуль/тема: sidebar, i18n, private, stats, docs, build, security.
2.4. В теле или футере — ссылка на KI: Refs KI-003 или Closes KI-003.
2.5. Один коммит — одна причина. Не смешивать рефакторинг, фикс и
     форматирование.
2.6. Запрещён git add -A. Файлы добавлять по путям; перед коммитом —
     git status.
2.7. Summary ≤ 72 символов, без точки в конце; тело — по желанию.
2.8. Не коммитить сгенерированные артефакты (project-inventory.txt,
     снапшоты) без отдельного решения.

## 3. KI-жизненный цикл

3.1. Любая проблема/ограничение → запись в docs/KNOWN_ISSUES.md.
     Даже «не баг» — статус Documented.
3.2. ID — следующий свободный, не переиспользовать. Пропуски (KI-024)
     не заполнять задним числом.
3.3. Обязательные поля: приоритет, статус, дата открытия, описание,
     план/решение, затронутые файлы, связанные.
3.4. Fixed только при наличии: конкретного файла/метода в записи,
     подтверждения в коде, проверки/теста. Иначе — In Progress/Open.
3.5. При закрытии — дата закрытия и версия; при отказе — Won't Fix
     и причина.
3.6. Приоритеты: Critical — краш/блокер; High — существенный UX/архитектура;
     Medium — обходится; Low — косметика.
3.7. Перед релизом — аудит реестра: сумма статусов = числу KI, нет дублей,
     нет Fixed без кода, нет Open с готовой работой.
3.8. Новые KI, найденные при аудите/ревью, сначала вносятся в реестр;
     Critical можно фиксить сразу, но запись обязательна.
3.20. Зомби-KI (номер сохранён из AI Workflow Builder).
     Зомби-KI — запись, статус которой противоречит коду/документации.
     Признаки: Fixed без ссылки на файл/метод; Fixed, но изменений в
     коде нет; Open/In Progress, хотя работа выполнена; ссылка на
     несуществующий файл. Действие: перевести в корректный статус в том
     же PR или завести отдельный KI; закрывать только после проверки
     в коде.

## 4. Документация

4.1. docs/README.md — единая точка входа: RULES, PROMPT_CURRENT,
     ARCHITECTURE, KNOWN_ISSUES, API, development, archive.
4.2. При изменении поведения обновлять в том же PR: README
     (пользовательское), CHANGELOG (всегда), KNOWN_ISSUES (если KI),
     PROMPT_CURRENT (метрики/архитектура).
4.3. Один источник истины. Не дублировать архитектуру в промптах;
     исторические промпты — в archive.
4.4. Markdown: каждый fence закрыт, таблицы с |, заголовки ##;
     перед коммитом проверять парность fences и ссылки.
4.5. Имена файлов — kebab-case, без «ИТОГ 13.txt»; версия/дата — в archive.
4.6. docs/archive/ — только чтение; не перемещать и не удалять без
     отдельного решения.
4.7. Ссылки в README/docs проверять на существование файлов; битые
     ссылки — блокер PR.
4.8. Отчёты — docs/development/reports/<version>/<NN>-<topic>.md;
     шаблон — docs/development/templates/REPORT_TEMPLATE.md.
4.9. Версия в docs должна совпадать с config.js/package.json;
     расхождение — KI.
4.10. README — витрина проекта; он не должен зависеть от файлов,
      которых нет в репозитории.

## 5. Ветки и PR

5.1. main защищена; работа в feature/<slug>, fix/<slug>, docs/<slug>,
     chore/<slug>.
5.2. Ветка от актуального main; один PR — одна задача/KI.
5.3. PR title — Conventional Commits; описание: что, зачем, KI,
     как проверить.
5.4. Чек-лист PR: KI обновлён; CHANGELOG; docs; нет console.log;
     нет секретов; страницы открываются; Markdown валиден; web.config
     не тронут без отдельного KI.
5.5. Не мержить с красными проверками; при отсутствии CI — ручной
     smoke-чеклист.
5.6. После merge удалить ветку; не оставлять «висящие» PR.
5.7. Не коммитить артефакты и секреты; staging — по путям.

## 6. Безопасность

6.1. Пользовательский контент — только через sanitizeHTML/DOMPurify;
     innerHTML без санитайзера запрещён.
6.2. Markdown — через markdownService (marked + DOMPurify), не
     самописный парсер.
6.3. Запрещены eval, new Function, setTimeout(string).
6.4. Файлы: проверять расширение, размер, MIME; не доверять имени.
6.5. Секреты/токены/пароли не хранить в репозитории; в localStorage —
     только необходимое.
6.6. Внешние ссылки — rel="noopener noreferrer", target="_blank".
6.7. CSP и заголовки — в web.config; менять только отдельным KI (KI-023).
6.8. Санитайзер не «улучшать» регулярками без тестов; комментарии
     «ПРОБЛЕМА» в sanitizer.js — устранить отдельным KI.
```

---

## 6. `PROMPT_CURRENT.md` (черновик)

```markdown
# PROMPT_CURRENT.md — Infocom LM Chat Pro

> Актуальный контекст для нового чата/агента. Обновлять при каждом релизе.
> Версия: v6.2 (config.js). Пакет: 6.2.0-dev. HEAD: 0a69031 (main, PR #2).
> Обновлено: 2026-10-19.

## 1. Что это

SPA-чат с AI-интеграцией (LM Studio), мультипользовательским режимом,
RAG, админ-панелью, играми и i18n.

- Клиент: vanilla JS, ES-модули, без сборщика.
- Серверы: LM Studio — 8034; .NET Core 3.1 API — 8032 (опционально);
  статика/IIS — 8033.
- Репозиторий: https://github.com/iilmchat/infocom-lm-chat
- Текущая ветка: main. HEAD: 0a69031.

## 2. Метрики

- KI всего: 33 (ID 001–034, KI-024 отсутствует).
- Fixed: 11; Open: 11; In Progress: 8; Deferred: 1;
  Documented: 1; Won't Fix: 1. Сумма: 33.
- Приоритеты: Critical — 3; High — 9; Medium — 11; Low — 10.
- Зомби-статусы: 12 явных + 3 требующих уточнения.
- SPA-модулей: 7 (Chat, Private, Admin, Games, Profile, Settings, Stats).
- ES-модулей в src/: 67 .js.
- Тестов: 2 файла (RAGManager, SessionManager). npm test сломан:
  нет tools/run-tests.js.
- Версия в config.js: 6.2. package.json: 6.2.0-dev.
  index.html и локали ещё показывают 6.1 — это расхождение (KI-039).

## 3. Открытые High/Critical

Critical Open: нет.

High Open по реестру: KI-002 (en.js на русском), KI-005 (Id/id),
KI-025 (нет offline mode), KI-029 (модель в UI).

Фактически:
- KI-029 уже исправлен в коде — статус устарел, перевести в Fixed.
- KI-032 числится Fixed, но btn-переменных в :root нет — фактически Open.
- KI-031 исправлен частично: setMode безопасен, но остались
  unguarded-обращения, плюс /profile падает (KI-035).

## 4. Архитектура

- Точка входа: index.html → src/app.js (class App).
- Ядро: EventBus (core/event-bus.js), Router (core/router.js),
  ErrorBoundary, Storage.
- App создаёт глобальный Sidebar (app.js:172); ChatModule создаёт
  только ChatView (ChatModule.js:26).
- Роутер: History API; маршруты /, /private, /admin, /games, /profile,
  /settings, /stats. Переключение контейнеров — App._showView (app.js:1857).
- Модули: ChatModule, PrivateChatModule, AdminModule, GamesModule,
  ProfileModule, SettingsModule, StatsModule.
- Сервисы: ApiService (LM Studio), ChatApiClient/http-client (.NET),
  AuthService, MarkdownService, Sanitizer, LongPollingClient,
  AvatarService, i18n.
- Модели: SessionManager, MultiUserManager, RAGManager,
  AssistantManager, AchievementManager, NotificationManager,
  WorkspaceManager, FileManager, ReactionManager, RateLimiter,
  InputHistory, EmbeddingCache, RoadmapTracker.
- UI: views/, components/, renderers/. CSS: main, themes, chat, sidebar,
  modals, admin, private-chat, games, responsive, markdown.
- Темы: dark (по умолчанию), light, monokai.
- localStorage: chat_sessions_v5, chat_theme, app_language, sidebar_width,
  server_config.

## 5. Текущие задачи v6.2

- A. Глобальный sidebar — сделано (KI-003, KI-013, KI-033, KI-034).
- B. Визуал основного чата — в работе.
- C. Завершение i18n — в работе (KI-002, KI-007).
- D. Уведомления в приватных чатах — сделано (KI-004, KI-027).
- E. Реальные графики StatsModule — не начато (KI-006).
- F. Фиксы после рефакторинга — в работе (KI-031, KI-029, KI-032).

## 6. Правила и ссылки

- [RULES.md](RULES.md) — правила кода, коммитов, KI, docs, PR.
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура (создать).
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — реестр KI.
- [API.md](API.md) — REST API.
- [../README.md](../README.md) — витрина.
- [../CHANGELOG.md](../CHANGELOG.md) — история версий.

## 7. Известные ловушки

- /profile падает: ProfileModule ищет initialsColorInput, а шаблон
  создаёт profileInitialsColor (KI-035).
- Тёмная тема: btn-переменные отсутствуют в :root (KI-036).
- README, CONTRIBUTING, KNOWN_ISSUES содержат незакрытые fence.
- KI-реестр содержит 12 зомби-статусов; не доверять статусам без
  проверки кода.
- npm test не работает; tools/check-ki.ps1 даёт ложное расхождение.
- docs/Промпт… и docs/Общая архитектура.txt устарели (v5/v6.0–6.1).

## 8. Как проверить

1. Запустить статику на 8033, LM Studio на 8034; API 8032 — опционально.
2. Открыть /, /private, /admin, /games, /profile, /settings, /stats.
3. Проверить консоль, переключение тем, профиль (модалку и страницу),
   уведомления, ресайз sidebar.
4. Проверить Markdown: все fence закрыты, таблицы с |, ссылки живые.
5. Запустить доступные тесты; npm test сейчас падает из-за отсутствия
   tools/run-tests.js.
```

---

## 7. Что не так / рекомендации

### 7.1. Главный вывод

Документация **формально существует**, но **не является надёжным источником истины**:
- **12 из 33 KI** — зомби-статусы (36%);
- ещё **3** требуют уточнения;
- **3 ключевых Markdown-файла** (`README.md`, `CONTRIBUTING.md`, `KNOWN_ISSUES.md`) содержат незакрытые fence;
- README непригоден для GitHub уже с 51-й строки;
- версии расходятся: 6.1 / 6.2 / 6.2.0-dev;
- нет `RULES.md`, `PROMPT_CURRENT.md`, `ARCHITECTURE.md`;
- нет единого индекса `docs/README.md`.

### 7.2. Что делать сначала (P0)

| # | Действие | Почему | Риск |
|---|---|---|---|
| 1 | Починить `ProfileModule` (ID `profileInitialsColor` / `initialsColorInput`) | `/profile` — целая SPA-страница, сейчас падает | Низкий; проверить и модалку, и страницу |
| 2 | Вернуть btn-переменные в `:root` **или** перевести KI-032 в `Open` | Тёмная тема — дефолтная; кнопки без фона | Визуальная регрессия; нужен screenshot-чек |
| 3 | Починить fence в `KNOWN_ISSUES.md` (727, 793) и статусы KI | Реестр нельзя читать на GitHub; статусы врут | Массовая правка статусов — только с проверкой кода |
| 4 | Переписать `README.md` | Первое впечатление, GitHub-витрина, битые ссылки | Потеря контента при переписывании; взять текущий текст за основу |

### 7.3. Что можно следующим этапом (P1)

| # | Действие | Комментарий |
|---|---|---|
| 5 | Создать `docs/RULES.md`, `docs/PROMPT_CURRENT.md`, `docs/ARCHITECTURE.md`, `docs/README.md` | Основа процесса; черновики уже в §5–6 |
| 6 | Синхронизировать версию 6.2: `index.html`, `locales/*.js`, README, CHANGELOG | Иначе пользователь видит v6.1 |
| 7 | Привести `CHANGELOG.md` в соответствие с реестром; убрать `docs/CONTRIBUTING.md` | Сейчас KI-029/031/032 приписаны к 6.1, а KI-032 не исправлен |
| 8 | Слить `CONTRIBUTING.md` в `RULES.md`; оставить короткий указатель | Убрать дублирование и обрезанный файл |
| 9 | Починить `npm test` (создать `tools/run-tests.js` или убрать скрипт) | Сейчас команда гарантированно падает |
| 10 | Исправить `tools/check-ki.ps1`: исключить шаблон, поддержать `Fixed (v6.2)` | Иначе аудит даёт ложное 34 vs 33 |

### 7.4. Что можно отложить (P2)

- Переписать `docs/API.md` в Markdown и сверить эндпоинты с `http-client.js`.
- Слить `docs/PROJECT_OVERVIEW.md` в user-guide/README, старую версию — в архив.
- Архивировать `docs/Промпт…v6.0→6.1.txt` и `docs/Общая архитектура.txt`.
- Перегенерировать/архивировать `project-inventory.txt`.
- Почистить `app.js` от AI-артефактов, `sidebar.js` — от `'local-model'`, `sanitizer.js` — от комментариев «ПРОБЛЕМА».
- Конвертировать `ROADMAP.md` и `MINIMETRO_SPEC.md` в Markdown.

### 7.5. Риски

1. **Массовое закрытие KI без проверки кода** скроет реальные регрессии. Сначала — по одному KI с evidence.
2. **Перемещение docs** сломает ссылки в README и KI. Делать одним PR с `docs/README.md` и проверкой ссылок.
3. **Правка тёмной темы** меняет визуальный baseline — нужен скриншот-чек всех трёх тем.
4. **Фикс `/profile`** затрагивает и страницу, и модалку; проверить оба сценария.
5. **RULES без CI** останутся декларацией; `check-ki.ps1` нужно добавить в git и сделать надёжным.
6. **web.config не трогаю** — это деплой, отдельная тема KI-023.

### 7.6. Статус работы

- Ни один файл репозитория не изменён, не создан и не перемещён (на момент аудита).
- `git status`: только ранее существовавший `?? tools/check-ki.ps1`.
- `RULES.md` и `PROMPT_CURRENT.md` — черновики в этом отчёте, отдельными файлами не создавал.
- Файл `docs/development/reports/v6.2/audit-01-docs.md` не создан на момент аудита.
