<!-- Добавлено в 6.2: offline smoke v6.2 (KI-025) -->
# Offline Smoke v6.2 (KI-025)

**Дата:** 2026-10-20<br>
**Ветка:** `feature/offline-mode` (от `main` = `059c97a`)<br>
**Автор:** DSH (static analysis; браузер и серверы не запускались)

## Сводка

- Всего проверок: 6
- ✅ Пройдено: 5 (static + Node-проверка `pingBackend`)
- ⚠️ Требует ручного подтверждения: 1 (runtime в браузере)
- ❌ Провалено: 0
- Новых KI: 0

Метод: анализ кода, карта сетевых вызовов и Node-проверка контракта
`pingBackend()`. Runtime-smoke в браузере не выполнялся — его должен
пройти пользователь по шагам из раздела 6.

## 1. Проверка: нет потока `ERR_CONNECTION_REFUSED`

При старте с выключенным бэкендом выполняется **ровно один** запрос
к `8032` — сам ping. Все остальные источники закрыты early return.

| # | Источник | Что происходит в офлайне | Доказательство |
|---|---|---|---|
| 1 | `ChatApiClient.pingBackend()` | 1 `GET /api/sync/ping`, таймаут 2 с; ошибка перехвачена и превращена в `false` | `client/src/services/http-client.js:121-153` |
| 2 | `AuthService.restoreSession()` | не вызывается из `init()`; внутри — `return null` до `getUser` | `client/src/app.js:681`, `client/src/services/auth-service.js:79` |
| 3 | `RoomList.loadRooms()` | не вызывается из `Sidebar.render()`; внутри — `return` до `getRooms` | `client/src/ui/views/sidebar.js:34-40`, `client/src/ui/views/room-list.js:18` |
| 4 | `MultiUserManager.loadPrivateChats()` | `return []` до `getUserChats`; список приватных чатов пуст | `client/src/models/multi-user-manager.js:1044` |
| 5 | `MultiUserManager.connectToServer()` | `return false` до `checkServerAvailability` | `client/src/models/multi-user-manager.js:459-463` |
| 6 | `MultiUserManager.getUnreadCount()` | `return 0` до запроса | `client/src/models/multi-user-manager.js:1144` |
| 7 | `NotificationManager.fetchNotifications()` | `return` до `getNotifications` | `client/src/models/notification-manager.js:30` |
| 8 | `NotificationManager.startPolling()` | не создаёт опрос; в колбэке — повторная проверка флага | `client/src/models/notification-manager.js:165-173` |

Почему в консоли всё равно будет **одна** запись
`net::ERR_CONNECTION_REFUSED`: её печатает сам браузер при неудачном
`fetch`, а не JS. Наш `catch` в `pingBackend()` молча возвращает `false`
(без `console.error`), поэтому нет ни `TypeError: Failed to fetch`,
ни записей `ErrorBoundary`. Остальные 7 источников из KI-025
до сети не доходят.

Дополнительно:

- `ChatView.loadMessages()` при `roomId === null` выходит **до**
  `getHistory` (`client/src/ui/views/chat-view.js:101-106`);
- heartbeat отправляется только при `isConnected && roomId`
  (`client/src/models/multi-user-manager.js:1232-1245`), в офлайне
  `isConnected = false`;
- `App.init()` не вызывает `fetchNotifications`/`connectToServer`,
  потому что `user === null` (`client/src/app.js:681-698`), и не
  открывает форму входа (`else if (!this.offlineMode)`).

Итог: стартовых запросов к `8032` — один (ping), сетевых ошибок —
одна, ровно как допускает задание.

### 1.1. Контракт `pingBackend()` (проверен в Node)

Метод импортирован из `client/src/services/http-client.js` и прогнан
против локальных серверов (Node 18+, тот же `fetch`/`AbortSignal`, что
и в браузере):

| Сценарий | Ожидание | Факт |
|---|---|---|
| Порт закрыт (`ECONNREFUSED`) | `false`, быстро | `false`, 13 мс |
| `200 OK` | `true` | `true` |
| `404` (эндпоинта нет) | `false` | `false` |
| Сервер не отвечает | `false` через ~2000 мс | `false`, 2007 мс |

Это подтверждает два свойства: ошибка не выбрасывается наружу, а
таймаут действительно срабатывает около 2 секунд.

## 2. Проверка: чат с LM Studio продолжает работать

- Ядро LM Studio не изменялось: `client/src/services/api-service.js`
  не затронут (жёсткое правило 3).
- `offlineMode` влияет только на `ChatApiClient` (порт `8032`) и
  менеджеры мультиплеера; `ApiService` (`/v1/models`,
  `/v1/chat/completions`, `/v1/embeddings`) работает как раньше.
- `App.init()` по-прежнему вызывает `api.checkServer()` и `fetchModels()`
  **до** проверки бэкенда (`client/src/app.js:621-627`), поэтому список
  моделей и отправка сообщений доступны и в офлайне.
- Ветка отправки сообщения (`ChatView.sendMessage` → `ApiService`)
  не содержит проверок `offlineMode` — блокировки нет.

Статический вывод: при живом LM Studio на `8034` и выключенном `8032`
отправка сообщений работает; единственное отличие — статус
«⚪ Офлайн (Сервер выключен)» и предупреждающий toast.

## 3. Проверка: кнопки мультиплеера не вызывают ошибок

| Элемент | Поведение в офлайне | Доказательство |
|---|---|---|
| Список комнат (`#roomList`) | Показывает «Мультиплеер недоступен в офлайн-режиме», `loadRooms()` не вызывается | `client/src/ui/views/sidebar.js:34-40` |
| Кнопка подключения (`#connectBtn`) | Warning-toast и `return` до `connectToServer` | `client/src/app.js:1627-1633` |
| Создание комнаты | Warning-toast и `return` до `createRoom` API | `client/src/ui/views/room-list.js:89-93` |
| Поиск комнат | `return` до `searchRooms` API | `client/src/ui/views/room-list.js:109` |
| Список приватных чатов | Пустой: `loadPrivateChats()` → `[]`, запросов `getUserChats`/`getUser` нет | `client/src/models/multi-user-manager.js:1044`, `client/src/ui/views/sidebar.js:226-239` |
| Навигация SPA (`/`, `/private`, `/admin`, …) | Не тронута: роутер и `_showView` работают | `client/src/app.js:396-407` |

Клик по комнате невозможен: список комнат в офлайне не рендерится
(нет элементов `.room-join-btn`). Приватный чат открыть нельзя:
список пуст, `openPrivateChatById` вызывается только из отрисованных
элементов.

## 4. Где именно стоит флаг

- Установка: `App.init()` — `this.offlineMode = !(await this.apiService.pingBackend())`
  (`client/src/app.js:629-630`); значение по умолчанию — `false`
  (`client/src/app.js:187`).
- Индикатор: `#statusDisplay` → `⚪ Офлайн (Сервер выключен)`,
  `color: var(--warning-color)` (`client/src/app.js:633-639`).
- Toast: «Бэкенд недоступен. Включен офлайн-режим.»
  (`client/src/app.js:635`).
- Ранние возвраты: 14 точек (таблицы 1 и 3).

## 5. Ограничения и замечания

1. **Runtime не выполнялся.** Нужен ручной прогон: выключить `8032`,
   открыть `/`, проверить консоль, отправить сообщение в LM Studio,
   кликнуть комнаты/приватные чаты.
2. **Эндпоинт `/api/sync/ping`.** В скопированном `server/` его нет:
   это API ProjectManager (KI-030, «не наш скоуп»). Реальный
   чат-бэкенд на `8032` должен отдавать `200 OK` на этот маршрут;
   иначе `pingBackend()` вернёт `false` (404) и клиент уйдёт в офлайн.
3. **Совместимость.** Для браузеров без `AbortSignal.timeout`
   (Chrome < 103) используется фолбэк `AbortController` + `setTimeout`
   на те же 2000 мс (`client/src/services/http-client.js:126-134`).
4. **Вне скоупа KI-025.** Страницы `/admin`, `/stats`, `/settings`
   при открытии выполняют собственные запросы к `8032` и в офлайне
   дадут сетевые ошибки. Задание ограничивало фикс списком методов
   (комнаты, приватные чаты, уведомления, авторизация); страницы
   админки/статистики требуют отдельного KI.
5. **Повторное подключение** не реализовано: после включения бэкенда
   нужна перезагрузка страницы (кнопка «Повторить подключение» была
   опциональным пунктом плана KI-025).

## 6. Ручной чек-лист (runtime)

1. Остановить .NET API на `8032` (LM Studio на `8034` — оставить).
2. Открыть `http://localhost:8033/` (статика из `client/`).
3. Консоль: не более одного `ERR_CONNECTION_REFUSED` (ping).
4. Статус в шапке: «⚪ Офлайн (Сервер выключен)»; toast об офлайне.
5. Блок комнат: «Мультиплеер недоступен в офлайн-режиме».
6. Отправить сообщение — ответ LM Studio приходит.
7. Кликнуть «Подключиться» — warning, без новых сетевых ошибок.
8. Включить `8032`, перезагрузить — статус «● Сервер доступен»,
   комнаты и приватные чаты загружаются.
