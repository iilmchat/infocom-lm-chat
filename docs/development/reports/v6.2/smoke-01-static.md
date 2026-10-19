<!-- Добавлено в 6.2: static smoke v6.2 (KI-032, KI-035, KI-036) -->
# Static Smoke v6.2

**Дата:** 2026-10-19<br>
**HEAD:** `b37aa2a` (`main`); код-фиксы KI-032/035/036 выполнены в ветке `feature/v6.2-refresh`<br>
**Автор:** DSH (read-only analysis)

## Сводка

- Всего проверок: 4
- ✅ Пройдено: 3
- ⚠️ Предупреждений: 1
- ❌ Провалено: 0
- Новых KI: 0

## Детали

| # | Проверка | Статус | Детали |
|---|---|---|---|
| 1 | `data-link` ↔ роут | ✅ | 7 из 7: `/`, `/private`, `/admin`, `/games`, `/profile`, `/settings`, `/stats` — все есть в `addRoute` |
| 2 | `--btn-*` во всех темах | ✅ | `:root` — 16, `[data-theme="light"]` — 16, `[data-theme="monokai"]` — 16; пропусков нет |
| 3 | Модалки и закрытие | ✅ | 8 из 8 модалок в `index.html` имеют close-обработчик или overlay-click |
| 4 | `console.log` в `src/` | ⚠️ | 26 вхождений; это известный KI-048, новых KI не требуется |

### 1. `data-link` ↔ роут

Значения `data-link` в `index.html`:

- `/`
- `/private`
- `/admin`
- `/games`
- `/profile`
- `/settings`
- `/stats`

Маршруты в `src/app.js` (`addRoute`) совпадают полностью — 7 из 7.

### 2. Темы и `--btn-*`

Проверено после фикса `KI-036`/`KI-032`:

- `src/styles/main.css`, блок `:root` — 16 переменных `--btn-*`;
- `src/styles/themes.css`, `[data-theme="light"]` — 16;
- `src/styles/themes.css`, `[data-theme="monokai"]` — 16.

Полный набор: `--btn-border-radius`, `--btn-primary-{bg,hover,text}`,
`--btn-secondary-{bg,hover,text}`, `--btn-danger-{bg,hover,text}`,
`--btn-success-{bg,hover,text}`, `--btn-warning-{bg,hover,text}`.
Пропущенных переменных нет ни в одной теме.

Дополнительно: `src/modules/profile/ProfileModule.js` после фикса `KI-035`
использует `this.initialsColor` (`#profileInitialsColor`) с guard
`if (this.initialsColor) ...`; обращений к `#initialsColorInput` больше нет.

### 3. Модалки и закрытие

| Модалка | Close-обработчик |
|---|---|
| `#roomInfoModal` | `#roomInfoModalClose` — `src/app.js:1655` |
| `#privateChatModal` | `#privateChatClose` + клик по overlay — `src/ui/views/private-chat.js:307-323` |
| `#serverSettingsModal` | `#serverSettingsClose` — `src/ui/views/settings-view.js:123` |
| `#shareModal` | `#shareModalClose` — `src/app.js:887`, `src/ui/views/share-view.js:64` |
| `#promptModal` | `#promptModalClose` — `src/app.js:912` |
| `#customAssistantModal` | `#customAssistantModalClose` — `src/app.js:924` |
| `#exportModal` | `#exportModalClose` — `src/ui/views/export-view.js:192` |
| `#infoModal` | `#infoModalClose` — `src/ui/views/info-view.js:98` |

Все 8 модалок закрываются. `ProfileModal` создаётся динамически и имеет
`#profileModalClose` (`src/ui/views/profile-modal.js:358`).

### 4. `console.log` в `src/`

Найдено **26** вхождений, в том числе:

- `src/app.js` — 8;
- `src/services/api-service.js` — 8;
- `src/models/multi-user-manager.js` — 5;
- `src/modules/chat/ChatModule.js` — 2;
- `src/games/mini-metro.js` — 3;
- `src/services/markdown-service.js` — 1.

Это известно как **KI-048** (AI-артефакты/логи), не новый KI. Массовая
зачистка `console.log` не входит в эту фазу.

## Найденные проблемы (новые KI)

Новых KI не обнаружено.

## Ограничения

- Runtime-smoke (браузер) **не выполнялся** — это делает пользователь.
- Список для runtime-smoke — в `docs/qa/RUNTIME_SMOKE_CHECKLIST.md` (создастся в Фазе 4).
- Проверка статическая: результаты по коду, без запуска приложения.
