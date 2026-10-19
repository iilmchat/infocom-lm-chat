<!-- Изменено в 6.2: README переписан (KI-026, KI-042) -->
<!-- Изменено в 6.2: монорепозиторий client/ + server/ (KI-052) -->
# Infocom LM Chat Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> SPA-чат с AI-интеграцией (LM Studio), RAG, приватными чатами, админ-панелью, играми и i18n.

**Текущая версия:** v6.2 · **Стек:** Vanilla JS (ES-модули) · HTML5 · CSS3 · .NET Core API · MS SQL Server<br>
**Репозиторий:** [github.com/iilmchat/infocom-lm-chat](https://github.com/iilmchat/infocom-lm-chat)

---

## Содержание

1. [Требования](#требования)
2. [Быстрый старт](#быстрый-старт)
3. [Развёртывание на IIS](#развёртывание-на-iis)
4. [Серверная часть (.NET)](#серверная-часть-net)
5. [Структура проекта](#структура-проекта)
6. [Основные функции](#основные-функции)
7. [Горячие клавиши](#горячие-клавиши)
8. [Известные проблемы](#известные-проблемы)
9. [Участие в разработке](#участие-в-разработке)
10. [Документация](#документация)

---

## Требования

Для полного функционала нужны три сервера:

| Сервис | Порт | Обязателен | Назначение |
|---|---|---|---|
| **LM Studio** | `8034` | ✅ Да | Генерация ответов (OpenAI-совместимый API) |
| **.NET Core API** | `8032` | ⚠️ Опционально | Комнаты, приватные чаты, пользователи, админка |
| **Статический сервер** | `8033` | ✅ Да | Раздача SPA |

> Без бэкенда на `8032` приложение работает в режиме одиночного чата
> с LM Studio, но в консоли будут `ERR_CONNECTION_REFUSED` для комнат
> и приватных чатов. Это известно и описано в
> [KI-025](docs/KNOWN_ISSUES.md).

**Браузеры:** Chrome 90+, Firefox 88+, Edge 90+, Safari 15+ (нужна поддержка ES-модулей).

---

## Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/iilmchat/infocom-lm-chat.git
cd infocom-lm-chat
```

### 2. Запуск LM Studio

1. Скачайте [LM Studio](https://lmstudio.ai/).
2. Загрузите модель.
3. Откройте **Local Server** и нажмите **Start Server**.
4. По умолчанию сервер поднимется на `http://127.0.0.1:8034`.

### 3. Запуск статического сервера

Клиент лежит в `client/`, поэтому статика раздаётся из этой папки:

```bash
# Python
cd client && python -m http.server 8033

# Node.js (serve)
cd client && npx.cmd serve . -l 8033

# Node.js (live-server, с автоперезагрузкой)
cd client && npx.cmd live-server --port=8033
```

Готовые скрипты лежат в `tools/scripts/` — они сами переходят в `client/`.

### 4. Открыть в браузере

```text
http://localhost:8033/
```

---

## Развёртывание на IIS

Проект содержит `web.config` в папке клиента (`client/web.config`) —
конфигурацию для IIS (порт `8033`). Корнем сайта должна быть папка `client/`.

**Что нужно:**

- IIS 10+ с ролью **Static Content**;
- [URL Rewrite Module 2.0](https://www.iis.net/downloads/microsoft/url-rewrite);
- Application Pool с **No Managed Code** (это статика).

**Что настраивает `web.config`:**

- SPA-роутинг: не-файловые запросы перенаправляются на `index.html`;
- MIME-типы для `.mjs`, `.json`, `.webmanifest`;
- кеширование статики и сжатие;
- заголовки безопасности (`X-Content-Type-Options`, `X-Frame-Options`).

Если URL Rewrite не установлен, в `web.config` есть закомментированный
fallback через `httpErrors` — SPA будет работать, но с HTTP-статусом `404`.

---

## Серверная часть (.NET)

Бэкенд — ASP.NET Core Web API (`netcoreapp3.1`, проект
`ProjectManager.API`), доступ к данным — EF Core + MS SQL Server.
Код лежит в `server/`, точка входа — `Program.cs` / `Startup.cs`.

**Требования:** .NET Core 3.1 SDK, MS SQL Server.

### Сборка

```bash
dotnet build server/ProjectManager.API.sln
```

### Запуск

```bash
dotnet run --project server/ProjectManager.API.csproj
```

Профиль запуска (`server/Properties/launchSettings.json`) по умолчанию
поднимает API на `http://localhost:5000`, а клиент ожидает его на `8032`
(`client/src/config.js`). Чтобы порты совпадали, задайте адрес явно:

```bash
dotnet run --project server/ProjectManager.API.csproj --urls http://localhost:8032
```

### Конфигурация и база данных

- строка подключения — `server/appsettings.json`
  (`ConnectionStrings:DefaultConnection`);
- миграции EF Core:
  `dotnet ef database update --project server/ProjectManager.API.csproj`;
- JWT-настройки — там же, в секции `Jwt`.

> ⚠️ В `server/appsettings.json` лежат строка подключения и JWT-ключ.
> Не коммитьте реальные секреты — используйте `dotnet user-secrets`
> или переменные окружения.

---

## Структура проекта

```text
infocom-lm-chat/
├── client/                 # Клиент — SPA (vanilla JS, ES-модули)
│   ├── index.html          # SPA-оболочка
│   ├── web.config          # Конфигурация IIS (порт 8033)
│   ├── package.json        # Метаданные и npm-скрипты
│   ├── locales/            # Переводы (ru.js, en.js)
│   ├── tests/              # Unit-тесты
│   ├── vendor/             # Сторонние библиотеки
│   └── src/                # Исходный код
│       ├── app.js          # Точка входа
│       ├── config.js       # Глобальная конфигурация
│       ├── core/           # EventBus, Router, ErrorBoundary
│       ├── games/          # Движки игр
│       ├── models/         # Менеджеры (Session, RAG, MultiUser)
│       ├── modules/        # SPA-модули (Chat, Admin, Games, …)
│       ├── services/       # Сервисы (API, i18n, Auth, Markdown)
│       ├── styles/         # CSS
│       ├── ui/             # Компоненты и рендереры
│       └── utils/          # Хелперы
│
├── server/                 # Сервер — .NET Core Web API (MS SQL Server)
│   ├── ProjectManager.API.sln
│   ├── ProjectManager.API.csproj
│   ├── Program.cs          # Точка входа
│   ├── Startup.cs          # Конфигурация приложения
│   ├── Controllers/        # REST-контроллеры
│   ├── Services/           # Бизнес-логика
│   ├── Data/               # DbContext, EF Core
│   ├── Migrations/         # Миграции EF Core
│   ├── Models/             # Сущности
│   ├── DTOs/               # Модели запросов/ответов
│   └── appsettings.json    # Строка подключения, JWT, LM Studio
│
├── docs/                   # Документация
│   ├── README.md           # Хаб документации
│   ├── API.md              # Справочник REST API
│   ├── KNOWN_ISSUES.md     # Реестр проблем (KI-XXX)
│   ├── PROJECT_OVERVIEW.md # Обзор проекта
│   ├── development/        # Отчёты и процессы разработки
│   ├── planning/           # Roadmap и спецификации
│   └── archive/            # Исторические материалы
│
├── tools/                  # Скрипты разработчика
├── CHANGELOG.md            # История версий
├── CONTRIBUTING.md         # Правила участия
├── LICENSE                 # MIT
└── README.md               # Этот файл
```

---

## Основные функции

**Чат с ИИ**

- потоковая генерация ответов через LM Studio;
- Markdown и подсветка кода (`marked` + `highlight.js`);
- ответы на сообщения, редактирование, перегенерация;
- экспорт диалога в TXT, JSON, Markdown и PDF.

**RAG**

- загрузка документов TXT, MD, PDF, DOCX;
- векторный поиск по чанкам;
- отображение источников с релевантностью.

**Приватные чаты и мультипользовательский режим**

- общие комнаты через Long Polling;
- приватные сообщения, реакции, упоминания, жалобы;
- уведомления и бейджи непрочитанных;
- роли Admin / Manager / User / Guest.

**Админ-панель**

- управление пользователями (бан, мут, кик, роли);
- управление комнатами (очистка, удаление, закрытие, экспорт);
- расширенный поиск по сообщениям;
- логи модерации.

**Игры**

- 2048, Змейка, Тетрис, Block Blast, Mini Metro.

**Персонализация**

- три темы: dark, light, monokai;
- аватары: emoji / инициалы / изображение;
- i18n (частично): ru, en;
- 20 достижений.

**SPA-страницы**

`/` — чат, `/private` — приватные, `/admin` — админка, `/games` — игры,
`/profile` — профиль, `/settings` — настройки, `/stats` — статистика.

---

## Горячие клавиши

| Клавиши | Действие |
|---|---|
| `Ctrl+Enter` | Отправить сообщение |
| `Shift+Enter` | Перенос строки |
| `Ctrl+Up` / `Ctrl+Down` | История ввода |
| `Escape` | Закрыть модальное окно / отменить ответ |
| `/` | Фокус на поле ввода |
| `Ctrl+W` | Открыть/закрыть Вики |
| `Ctrl+E` | Экспорт диалога |
| `Ctrl+S` | Открыть окно «Поделиться» |

---

## Известные проблемы

Полный реестр — в [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

| ID | Описание | Приоритет |
|---|---|---|
| KI-002 | `locales/en.js` содержит русские строки | High |
| KI-005 | Дублирование полей `Id`/`id` в моделях | High |
| KI-025 | Нет graceful degradation без бэкенда | High |
| KI-006 | `StatsModule` использует заглушки вместо графиков | Medium |
| KI-011 | Нет тестов на i18n, NotificationManager, WorkspaceManager | Medium |

---

## Участие в разработке

Правила участия — в [CONTRIBUTING.md](CONTRIBUTING.md).

Кратко:

- любая проблема фиксируется в `docs/KNOWN_ISSUES.md`;
- ветки: `feature/<name>`, `fix/<name>`, `docs/<name>`;
- коммиты — Conventional Commits: `feat(sidebar): ...`, `fix(i18n): ...`;
- в коммите — ссылка на KI: `Closes KI-003`.

Процессные документы и правила разработки будут в `docs/development/`.

---

## Документация

- [Хаб документации](docs/README.md)
- [REST API](docs/API.md)
- [Реестр проблем](docs/KNOWN_ISSUES.md)
- [Обзор проекта](docs/PROJECT_OVERVIEW.md)
- [История версий](CHANGELOG.md)

---

## Лицензия

MIT — см. [LICENSE](LICENSE).

**© 2026 RuChating (iilmchat) · Infocom LM Chat Pro v6.2**
