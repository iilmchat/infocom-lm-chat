# Changelog

Все значимые изменения в проекте **Infocom LM Chat Pro**.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [SemVer](https://semver.org/lang/ru/).

## [Unreleased] — v6.2 (в разработке)

### Added
- `docs/KNOWN_ISSUES.md` — реестр известных проблем (правило KI)
- `docs/CONTRIBUTING.md` — правила участия
- `tools/inventory.ps1` — скрипт инвентаризации проекта
- `NotificationManager.addNotification()` — создание локальных уведомлений (KI-004)
- `NotificationManager.clearLocal()` — очистка локальных уведомлений
- Отслеживание реально новых сообщений в приватных чатах (KI-027)
- Глобальный sidebar — доступен на всех страницах (чат, приватные, админ, игры, профиль, настройки, статистика) (KI-003)
- Метод `App.openPrivateChatById(chatId, userId)` для навигации в приватный чат из sidebar (KI-003)
- Утилита `App._showView(viewId)` для надёжного переключения view (KI-033)
- Ресайзабельный sidebar: перетаскиваемая граница ширины 220–600px (KI-034)
- Сохранение ширины sidebar в `localStorage` (KI-034)

### Changed
- **i18n:** локали переведены из `.json` в ES-модули (`locales/ru.js`, `locales/en.js`)
  из-за несовместимости `import ... assert { type: 'json' }` с браузерами (KI-001)
- Версия в `config.js` обновлена с 6.1 до 6.2
- `Sidebar` перенесён из `ChatModule` в `App` (KI-013)
- `#sidebar` вынесен из `#app-chat` в корень `#app` (KI-003)
- `PrivateChatModule` — убран вложенный sidebar со списком чатов, используется глобальный (KI-003)
- `ChatModule` теперь отвечает только за `ChatView` (KI-013)

### Fixed
- `SyntaxError: Unexpected identifier 'assert'` в `src/services/i18n.js` (KI-001)
- Уведомления в приватных чатах: устранён спам уведомлений при каждой загрузке истории (KI-027)
- `NotificationManager.markRead()` корректно обрабатывает локальные ID (KI-004)
- `NotificationManager.fetchNotifications()` больше не теряет локальные уведомления (KI-004)
- Убран опциональный вызов `?.` для `notificationManager.addNotification()` (KI-012)
- Sidebar больше не скрывается на страницах `/private`, `/admin`, `/games`, `/profile`, `/settings`, `/stats` (KI-003)
- Убран риск дублирования Sidebar из-за пересоздания ChatModule (KI-013)
- При переходе на `/settings`, `/stats` больше не остаётся видимым `#app-chat` (KI-033)

### Planned (Задачи v6.2)
- Задача A — глобальный sidebar (KI-003, KI-013)
- Задача B — визуал основного чата
- Задача C — завершение i18n (KI-002, KI-007)
- Задача D — уведомления в приватных чатах (KI-004)
- Задача E — реальные графики в StatsModule (KI-006)
- Задача F — фикс ошибок после рефакторинга

---

## [6.1] — 2026-09-?? (текущий релиз)

### Added
- `AvatarService` — три режима аватара (emoji / initials / image)
- `SettingsModule` — полноэкранная страница настроек сервера
- `StatsModule` — страница статистики и аналитики
- `ProfileModule` — страница профиля со статистикой, экспортом/импортом
- `i18n` — модуль интернационализации (`ru`, `en`)
- `PrivateChatModule` — упоминания (@), поиск, пагинация
- Игра **Mini Metro**
- Универсальные стили кнопок: `.btn`, `.btn-primary`, `.btn-secondary`,
  `.btn-danger`, `.btn-success`, `.btn-warning`, `.btn-sm`, `.btn-lg`

### Changed
- Переменные кнопок добавлены во все темы (`themes.css`)
- Кнопки в динамических элементах переведены на классы `.btn*`
- `AvatarService` внедрён в профиль и sidebar

### Fixed
- Мелкие UI-фиксы в приватных чатах\
- **KI-031:** `ProfileModal.setMode('login')` больше не падает из-за
  отсутствующего `#userColorInput` — устранён блокирующий краш `init()`,
  из-за которого не работали dropdown моделей, Share, Theme, Analytics,
  Notifications и горячие клавиши
- **KI-029:** синхронизация `App.currentModel` с `ApiService.currentModel`
  после `fetchModels()`; модель в шапке показывает реально загруженную
- **KI-029:** `SessionManager.defaultModel` берётся из `CONFIG.UI_CONFIG.DEFAULT_MODEL`
  вместо хардкода `'local-model'`
- **KI-032:** в тёмную тему (`:root`) добавлены btn-переменные — кнопки
  теперь корректно переключаются между темами

---

## [6.0] — 2026-08-??

### Added
- **SPA-роутинг** на History API (`src/core/router.js`)
- Модульная архитектура: `ChatModule`, `PrivateChatModule`, `AdminModule`,
  `GamesModule`, `ProfileModule`, `SettingsModule`, `StatsModule`
- Динамическая загрузка модулей через `import()`
- Контейнеры `#app-*` для каждой страницы
- Навигационные кнопки с `data-link`
- `AnalyticsView` — модальное окно аналитики

### Changed
- Приложение разделено на страницы (чат, приватные, админка, игры, профиль)
- Убраны модальные окна админки/игр/профиля в пользу страниц

### Removed
- Прямое создание `AdminPanel` и `GameView` в конструкторе `App` (теперь по требованию)

---

## [5.4] — 2026-07-??

### Fixed
- Ошибка с определением `bash` в подсветке кода
- Дублирование обработчиков в админ-панели
- Мелкие правки пагинации пользователей

### Changed
- Полноэкранный режим для игр
- Улучшена навигация в `GameView`

---

## [5.3] — 2026-07-??

### Added
- `WorkspaceManager` — рабочие пространства (Личное, etc.)
- `ProfileModal` — единое модальное окно входа и профиля
- `responsive.css` — адаптивная вёрстка (≤768px, ≤480px)
- Виртуальный скролл (экспериментальный, отключён)
- Пагинация пользователей в админке
- URL-фильтры и экспорт результатов поиска в админке
- Экспорт в `.pdf`

### Changed
- Удалены `AuthModal` и `UserModal` (заменены на `ProfileModal`)

---

## [5.2] — 2026-06-??

### Added
- `MarkdownService` — рендеринг Markdown через `marked` + `DOMPurify`
- Подсветка кода через `highlight.js` (глобально, не самописный `syntaxHighlighter`)
- Поддержка `.docx` (через `mammoth.browser.min.js`)
- Расширенный поиск в админ-панели (по дате, комнате, автору)
- Отображение пользователей в комнате (админка, по клику на счётчик)

### Removed
- Самописный `syntax-highlighter.js` и связанные методы
  (`upgradeSessions`, `extractCodeBlocks`, `createCodeBlockHTML`,
  `highlightMessageSync`, `getMessagesWithHighlight`)

---

## [5.1] — 2026-06-??

### Added
- **Аутентификация** (`AuthService`, регистрация, восстановление сессии)
- **Приватные чаты** (сообщения, реакции, закрепления, жалобы, вложения, упоминания)
- **Общие комнаты** (`RoomList`, создание, вход, выход)
- **Long Polling** (`LongPollingClient`, `MultiUserManager.poll`)
- **Уведомления** (`NotificationManager`, бейдж, модальное окно)
- **Аналитика** (`AnalyticsView`: глобальная, пользовательская, по комнатам)
- **Файлы** (`FileManager`, загрузка, скачивание, вложения)
- Игры: **Block Blast**
- Админ-панель: бан, мут, кик, управление комнатами, роли
- Реакции: 👍 ❤️ 😂 😮 😢 😡
- Экспорт диалога: TXT / JSON / Markdown / PDF
- Горячие клавиши: `Ctrl+↑/↓` (история ввода), `Ctrl+Enter`, `Ctrl+W`,
  `Ctrl+E`, `Ctrl+S`, `Escape`

### Changed
- Единая шина событий `EventBus`
- Разделение `ApiService` (LM Studio) и `ChatApiClient` (основной API)

---

## [5.0] — 2026-05-?? (базовая версия)

### Added
- Чат с ИИ через **LM Studio** (`ApiService`)
- RAG (`RAGManager`, `EmbeddingCache`)
- Code Review, генерация тестов
- Сессии чата (`SessionManager`)
- Ассистенты (`AssistantManager`, 7 встроенных)
- Достижения (`AchievementManager`, 20 штук)
- Экспорт диалогов
- Три темы: `dark`, `light`, `monokai`
- Drag-and-Drop файлов (`DropZone`)
- Игры: 2048, Змейка, Тетрис

---

[Unreleased]: https://github.com/iilmchat/infocom-lm-chat/compare/v6.1...HEAD
[6.1]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v6.1
[6.0]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v6.0
[5.4]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v5.4
[5.3]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v5.3
[5.2]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v5.2
[5.1]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v5.1
[5.0]: https://github.com/iilmchat/infocom-lm-chat/releases/tag/v5.0