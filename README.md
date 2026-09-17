# Infocom LM Chat Pro

> SPA-чат с AI-интеграцией (LM Studio), мультипользовательским режимом,
> RAG, админ-панелью, играми и i18n.

**Текущая версия:** 6.1 → в работе 6.2 (см. `CHANGELOG.md`)
**Стек:** Vanilla JS (ES-модули) · HTML5 · CSS3 · .NET Core 3.1 API · MS SQL Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Содержание

1. [Требования](#-требования)
2. [Быстрый старт](#-быстрый-старт)
3. [Развёртывание на IIS](#-развёртывание-на-iis)
4. [Структура проекта](#-структура-проекта)
5. [Основные функции](#-основные-функции)
6. [Горячие клавиши](#-горячие-клавиши)
7. [Известные проблемы](#-известные-проблемы)
8. [Участие в разработке](#-участие-в-разработке)
9. [Лицензия](#-лицензия)

---

## 🖥️ Требования

### Для полного функционала нужны три сервера

| Сервис | Порт | Обязателен | Назначение |
|---|---|---|---|
| **LM Studio** | `8034` | ✅ Да | Генерация ответов (OpenAI-совместимый API) |
| **.NET Core API** | `8032` | ⚠️ Опционально | Комнаты, приватные чаты, пользователи, админка |
| **Статический сервер** | `8033` | ✅ Да | Раздача SPA |

> ⚠️ **Без бэкенда на 8032** приложение работает в режиме одиночного чата
> с LM Studio, но консоль покажет `ERR_CONNECTION_REFUSED` для комнат
> и приватных чатов. Это ожидаемо (см. [KI-025](docs/KNOWN_ISSUES.md)).

### Браузеры

Chrome 90+, Firefox 88+, Edge 90+, Safari 15+ (нужна поддержка ES-модулей).

---

## 🚀 Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/iilmchat/infocom-lm-chat.git
cd infocom-lm-chat

2. Запуск LM Studio
Скачать: https://lmstudio.ai/
Загрузить модель, перейти в раздел Local Server, нажать Start Server.
По умолчанию поднимется на http://127.0.0.1:8034.

3. Запуск статического сервера
Выберите один из вариантов:

bash
# Python
python -m http.server 8033

# Node.js (serve)
npx.cmd serve . -l 8033

# Node.js (live-server, с автоперезагрузкой)
npx.cmd live-server --port=8033
Готовые скрипты — в tools/scripts/:

start-python.sh

start-live-server.sh

4. Открыть в браузере
text
http://localhost:8033/
Развёртывание на IIS
Проект содержит web.config в корне с настройками для IIS (порт 8033).

Что нужно
IIS 10+ с установленными ролями:

Static Content

URL Rewrite Module 2.0 (скачать)

Настройка сайта в IIS Manager:

Physical path: путь к папке проекта

Binding: http://<host>:8033

Application Pool: .NET CLR version — «No Managed Code» (это статика)

Что настраивает web.config
SPA-роутинг: все не-файловые запросы перенаправляются на index.html

MIME-типы для .mjs, .json, .webmanifest

Кеширование статики на 7 дней

Сжатие (gzip/deflate)

Заголовки безопасности: X-Content-Type-Options, X-Frame-Options

Если URL Rewrite не установлен
В web.config есть закомментированный fallback через httpErrors.
Раскомментируйте его — SPA будет работать, но с HTTP-статусом 404
(см. KI-023 в docs/KNOWN_ISSUES.md).

Структура проекта
text
infocom-lm-chat/
├── index.html              # SPA-оболочка
├── web.config              # Конфиг IIS (порт 8033)
├── package.json            # Метаданные и npm-скрипты
├── LICENSE                 # MIT
├── README.md               # Этот файл
├── CHANGELOG.md            # История версий
├── CONTRIBUTING.md         # Правила участия
├── .gitignore
├── .editorconfig
│
├── docs/                   # Документация
│   ├── API.md              # Справочник REST API
│   ├── PROJECT_OVERVIEW.md # Обзор проекта
│   ├── KNOWN_ISSUES.md     # Реестр проблем (KI-XXX)
│   ├── PROMPT_FOR_NEW_CHAT.md  # Контекст для нового чата
│   └── archive/            # Исторические материалы
│       ├── snapshots/      # Снапшоты кода
│       ├── mini-metro/     # Итерации разработки Mini Metro
│       ├── legacy/         # Legacy-код (syntax-highlighter, modals)
│       └── v5.2/, v5.3/, v6.x/  # Заметки по версиям
│
├── src/                    # Исходный код (ES-модули)
│   ├── app.js              # Точка входа
│   ├── config.js           # Глобальная конфигурация
│   ├── core/               # EventBus, Router, ErrorBoundary
│   ├── games/              # Движки игр
│   ├── models/             # Менеджеры (Session, RAG, MultiUser)
│   ├── modules/            # SPA-модули (Chat, Admin, Games)
│   ├── services/           # Сервисы (API, i18n, Auth, Markdown)
│   ├── styles/             # CSS
│   ├── ui/                 # Компоненты и рендереры
│   └── utils/              # Хелперы
│
├── locales/                # Переводы (ru.js, en.js)
├── tests/                  # Unit-тесты
├── tools/                  # Утилиты разработчика
│   ├── inventory.ps1       # Инвентаризация проекта
│   ├── cleanup.ps1         # Уборка legacy
│   ├── organize-docs.ps1   # Раскладка docs/
│   ├── build-archive.mjs   # Генератор снапшотов кода
│   ├── archive/
│   └── scripts/            # Скрипты запуска
│
└── vendor/                 # Сторонние библиотеки (highlight, marked, purify)
Основные функции
Чат с ИИ
Потоковая генерация ответов через LM Studio

Markdown + подсветка кода (marked + highlight.js)

Ответы на сообщения, редактирование, перегенерация

Экспорт диалога: TXT / JSON / Markdown / PDF

RAG
Загрузка документов (TXT, MD, PDF, DOCX)

Векторный поиск по чанкам (text-embedding-nomic-embed-text-v1.5)

Отображение источников с релевантностью

Мультипользовательский режим
Общие комнаты (Long Polling)

Приватные чаты (сообщения, реакции, упоминания, жалобы)

Уведомления, бейджи непрочитанных

Роли: Admin / Manager / User / Guest

Админ-панель
Управление пользователями (бан, мут, кик, роли)

Управление комнатами (очистка, удаление, закрытие, экспорт)

Расширенный поиск по сообщениям с фильтрами

Логи модерации

Игры
2048, Змейка, Тетрис, Block Blast, Mini Metro

Персонализация
3 темы: dark, light, monokai

Аватары: emoji / инициалы / изображение

i18n (частично): ru, en

20 достижений

SPA-страницы
/ — чат с ИИ

/private — приватные чаты

/admin — админ-панель

/games — игры

/profile — профиль

/settings — настройки сервера

/stats — статистика

Горячие клавиши
Клавиши	Действие
Ctrl+Enter	Отправить сообщение
Shift+Enter	Перенос строки
Ctrl+Up / Ctrl+Down	История ввода
Escape	Закрыть модальное окно / отменить ответ
/	Фокус на поле ввода
Ctrl+W	Открыть/закрыть Вики
Ctrl+E	Экспорт диалога
Ctrl+S	Открыть окно «Поделиться»
Известные проблемы
Полный реестр — в docs/KNOWN_ISSUES.md.

Ключевые открытые проблемы:

ID	Описание	Приоритет
KI-003	Sidebar не глобальный (внутри #app-chat)	Critical
KI-004	NotificationManager.addNotification() не реализован	High
KI-025	Нет graceful degradation без бэкенда	High
KI-007	i18n покрывает менее 5% строк	Medium
KI-006	StatsModule использует заглушки вместо графиков	Medium
Участие в разработке
Правила — в CONTRIBUTING.md. Кратко:

Любая проблема — запись в docs/KNOWN_ISSUES.md с номером KI-XXX

Ветки: feature/<name>, fix/<name>, chore/<name>

Коммиты — Conventional Commits: feat(sidebar): ..., fix(i18n): ...

В конце коммита — ссылка на KI: Closes KI-003

Лицензия
MIT — см. LICENSE.

© 2026 RuChating (iilmchat) · Infocom LM Chat Pro