# API Менеджер ИТ-проектов (v2.4)

Все эндпоинты, кроме указанных, требуют заголовок `Authorization: Bearer <token>`.

Базовый URL: `https://<host>:8035`

Формат ответа:
```json
{
  "success": true,
  "data": {...},
  "message": "..."
}

Система
GET /api/version
Возвращает текущую версию API и release notes.

Ответ: { "version": "2.4", "releaseNotes": "..." }

Аутентификация
POST /api/auth/register
Регистрация. Тело: { "username": "...", "password": "..." }

POST /api/auth/login
Вход. Тело: { "username": "...", "password": "..." }. Возвращает токен.

GET /api/auth/sessions?userId={userId}
Список сессий. Только для владельца или админа.

POST /api/auth/sessions/end?sessionId={sessionId}
Завершить сессию.

POST /api/auth/logout-all
Завершить все сессии. Тело: { "userId": 1 }

Проекты
GET /api/projects
Список проектов с пагинацией.

POST /api/projects
Создать проект. Тело: { "name": "..." }

GET /api/projects/{id}
Детали проекта.

POST /api/projects/{id}/update
Обновить название. Тело: { "name": "..." }

POST /api/projects/{id}/delete
Удалить проект.

POST /api/projects/{id}/close
Закрыть проект.

POST /api/projects/{id}/copy
Копировать проект. Тело: { "newName": "..." } (опционально).

POST /api/projects/{id}/restore
Восстановить закрытый проект.

Владельцы
GET /api/projects/{projectId}/owners
Список владельцев.

POST /api/projects/{projectId}/owners
Добавить владельца. Тело: { "userId": 2 }

POST /api/projects/{projectId}/owners/{ownerId}/remove
Удалить владельца.

Документы
GET /api/projects/{projectId}/documents
Все версии документов. Параметры: page, pageSize, type.

GET /api/projects/{projectId}/documents/active
Активные (принятые) документы.

GET /api/projects/{projectId}/documents/versions?type={type}
Все версии документа указанного типа.

GET /api/projects/{projectId}/documents/{documentId}
Конкретная версия.

POST /api/projects/{projectId}/documents
Создать документ. Тело: { "type": "ИД", "title": "...", "content": "..." }

POST /api/projects/{projectId}/documents/{documentId}/update
Обновить черновик. Тело: { "title": "...", "content": "..." }

POST /api/projects/{projectId}/documents/{documentId}/accept
Принять документ. При принятии ИД автоматически запускается аналитик; при принятии ТТ — аналитик (этап 2) и архитектор; при принятии всех архитектурных артефактов — декомпозиция задач; при принятии всех входных документов тестировщика — тестировщик. Принятие СФС запускает .bat скрипт.

POST /api/projects/{projectId}/documents/{documentId}/delete
Удалить черновик.

GET /api/projects/{projectId}/documents/search?query={query}
Поиск по документам.

ИИ: базовые
POST /api/projects/{projectId}/run-bat
Запуск .bat скрипта.

POST /api/projects/{projectId}/code
Сохранение файла. Тело: { "path": "src/...", "content": "..." }

POST /api/projects/{projectId}/commit
Git commit. Тело: { "message": "..." }

ИИ: Аналитик
POST /api/projects/{projectId}/assistant/analyst/tt
Генерация ТТ на основе принятого ИД. Запускается автоматически при принятии ИД.

POST /api/projects/{projectId}/assistant/analyst/analysis
Генерация АТ, РИСК, ПИ на основе принятого ТТ. Запускается автоматически при принятии ТТ.

ИИ: Архитектор
POST /api/projects/{projectId}/assistant/architect
Генерация ИТ, СП, СФС, ЭР на основе принятых ИД и ТТ. Запускается автоматически при принятии ТТ.

ИИ: Разработчик
POST /api/projects/{projectId}/assistant/developer/plan
Генерация плана задач на основе принятых ИТ, СП, СФС, ЭР. Запускается автоматически при принятии всех архитектурных артефактов.

GET /api/projects/{projectId}/assistant/developer/tasks
Список задач разработчика.

PUT /api/projects/{projectId}/assistant/developer/tasks/{taskId}
Обновить задачу. Тело: { "title": "...", "description": "...", "order": 1, "comment": "..." }

POST /api/projects/{projectId}/assistant/developer/plan/approve
Утвердить план задач.

POST /api/projects/{projectId}/assistant/developer/tasks/{taskId}/run
Выполнить задачу. При успехе создаются документы КОД/КОНФ/ДР.

POST /api/projects/{projectId}/assistant/developer/tasks/{taskId}/approve
Подтвердить результат задачи. Автоматически запускает следующую задачу.

POST /api/projects/{projectId}/assistant/developer/tasks/{taskId}/reject
Отклонить результат. Тело: { "comment": "..." }

ИИ: Тестировщик
POST /api/projects/{projectId}/assistant/tester
Генерация ТП, ТК, ОТ на основе принятых АТ, ПИ, КОД, ДР. Запускается автоматически при принятии всех входных документов.

Админ: LM Studio
GET /api/admin/lmstudio-settings
Текущие настройки LM Studio.

PUT /api/admin/lmstudio-settings
Обновить настройки. Тело:

json
{
  "baseUrl": "http://localhost:8034",
  "defaultModel": "llama3-8b",
  "healthCheckIntervalSeconds": 60,
  "modelsCachePath": "Data/ModelsCache.json",
  "analystModel": "llama3-8b",
  "architectModel": "llama3-8b",
  "developerModel": "qwen2.5-coder-7b",
  "testerModel": "llama3-8b"
}
GET /api/admin/lmstudio/health
Проверка доступности LM Studio.

GET /api/admin/lmstudio/models
Список доступных моделей.

Админ: Промты
GET /api/admin/assistant-prompts
Список всех промтов.

GET /api/admin/assistant-prompts/{assistantType}
Получить промт по типу (Analyst, Analyst_TT, Analyst_Analysis, Architect, Developer_Plan, Developer_Task, Tester).

PUT /api/admin/assistant-prompts/{assistantType}
Обновить промт. Тело: { "systemPrompt": "..." }

text

---

## 6. Обновление CHANGELOG.md

Создайте `CHANGELOG.md`:

```markdown
# История изменений

## [2.4] - 2026-XX-XX

### Добавлено
- ИИ-ассистент «Аналитик»: генерация ТТ (этап 1), АТ, РИСК, ПИ (этап 2).
- ИИ-ассистент «Разработчик»: декомпозиция архитектурных артефактов на задачи, поэтапное выполнение с ручным подтверждением, возможность отклонения с комментарием.
- ИИ-ассистент «Тестировщик»: генерация ТП, ТК, ОТ.
- Модель `DeveloperTask` и API для управления задачами разработчика.
- Событийная модель автоматического запуска ассистентов при принятии входных документов.
- Поддержка индивидуальных моделей LM Studio для каждого ассистента (AnalystModel, ArchitectModel, DeveloperModel, TesterModel).
- Интерфейс `IOutputPostProcessor` для постобработки контента от LM Studio.
- Новые типы документов: АТ, РИСК, ПИ, КОД, КОНФ, ДР, ТП, ТК, ОТ и соответствующие ERR_*.
- Ограничение размера тела запроса (5 МБ).
- Rate limiting для эндпоинтов аутентификации (настраивается через appsettings).
- Эндпоинт `GET /api/version` и заголовок `X-App-Version`.

### Изменено
- Аутентификация переведена на стандартный механизм ASP.NET Core с кастомным обработчиком.
- Сессии не раскрывают полный токен (только превью).
- `DocumentService.AcceptDocumentAsync` теперь запускает фоновые задачи ассистентов.
- Все асинхронные методы поддерживают `CancellationToken`.
- Унифицированы DTO (удалены дублирующиеся классы).
- Устранены N+1 запросы в `ProjectService`.

### Исправлено
- Критическая ошибка в `Startup.cs` (отсутствие `;`).
- Несоответствие версии SDK.
- Неверное имя DLL в web.config.
- Уязвимость в `AuthController.GetSessions`.
- Баг в `ArchitectService` при определении типа документа для ошибок.

## [2.3] - ...
...