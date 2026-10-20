<!-- Добавлено в 6.2: README для InfocomChat.Server (заменил ProjectManager.API) -->
# InfocomChat.Server

Серверная часть Infocom LM Chat Pro: ASP.NET Core Web API и SignalR для
real-time обмена. Пришёл на смену `ProjectManager.API`.

## Стек

- ASP.NET Core Web API, `netcoreapp3.1` (`InfocomChat.Server.csproj`),
  точка входа — `Program.cs` + `Startup.cs`.
- Entity Framework Core 3.1, MS SQL Server — `ChatDbContext`
  (`server/Database/`).
- SignalR — хаб `ChatHub` (`server/Hubs/ChatHub.cs`), endpoint `/chatHub`.
- Логирование — консоль и файл `logs/app-<дата>.log`.

## Требования

- .NET Core 3.1 SDK (версия закреплена в `server/global.json`: `3.1.201`);
- MS SQL Server;
- свободный порт `8032` для HTTP API.

## Конфигурация

`server/appsettings.json` — секреты в репозиторий не коммитятся, значения
уточняются на стенде:

| Ключ | Назначение |
|---|---|
| `ConnectionStrings:DefaultConnection` | строка подключения к MS SQL Server |
| `ChatSettings` | лимиты сообщений, истории, комнат |
| `Server` | порт, роль по умолчанию, флаги гостей/регистрации |
| `CorsSettings` | разрешённые origins, методы и заголовки |
| `Database` | тип БД и параметры EF Core |
| `LM` | параметры LM Studio для интеграций |

`server/appsettings.Development.json` переопределяет настройки для
локальной разработки.

## Запуск

```bash
dotnet restore server/InfocomChat.Server.csproj
dotnet build server/InfocomChat.Server.csproj
dotnet run --project server/InfocomChat.Server.csproj
```

Сервер слушает `http://127.0.0.1:8032` (см. `Program.cs`). Схема БД
создаётся автоматически при старте — `Database.EnsureCreated()` в
`Startup.Configure`; отдельный `dotnet ef database update` не требуется.

## API и real-time

- REST — `server/Controllers/`: `/api/chat`, `/api/room`, `/api/sync`,
  `/api/private`, `/api/auth`, `/api/admin`, `/api/analytics`,
  `/api/notifications`, `/api/reaction`, `/api/attachment`.
- SignalR — `/chatHub` (`server/Hubs/ChatHub.cs`).
- Ручной тестер API — `docs/qa/manual-api-check/index.html`.

## Структура

| Папка | Назначение |
|---|---|
| `Controllers/` | REST-контроллеры и маршрутизация |
| `Services/` | бизнес-логика (`RoomManager`, `PrivateChatService`, ...) |
| `Database/` | `ChatDbContext`, конфигурация БД |
| `Migrations/` | `ChatDbContextModelSnapshot.cs`, `XXXXXXXXXXXXXX_AddDatabaseIndexes.cs` |
| `Models/`, `DTOs/`, `Mappers/` | сущности и контракты API |
| `Hubs/` | SignalR |
| `Middleware/` | глобальная обработка ошибок |

Дополнительные материалы — `server/Docs/`.
