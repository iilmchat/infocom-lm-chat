using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ProjectManager.API.Data;
using ProjectManager.API.DTOs;
using ProjectManager.API.Models;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Services
{
    /// <summary>
    /// Реализация сервиса для управления системными промтами ассистентов.
    /// </summary>
    public class AssistantPromptService : IAssistantPromptService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AssistantPromptService> _logger;

        // Промт для архитектора (по умолчанию)
        private const string DefaultArchitectPrompt = 
            "Ты — архитектор программных систем. Твоя задача — на основе предоставленных документов проекта (ИД — исходные данные, ТТ — техническое задание) разработать:\n" +
            "1. Используемые технологии (ИТ) — описание технологического стека.\n" +
            "2. Структуру проекта (СП) — описание модулей и их взаимодействия.\n" +
            "3. Структуру файловой системы (СФС) — bat-скрипт для создания папок и файлов.\n" +
            "4. Этапы разработки (ЭР) — план работ с сроками и задачами.\n\n" +
            "Для каждого из этих артефактов вызови функцию create_file с соответствующим path и content.\n" +
            "Пути должны быть относительными, внутри папки DOCS/ проекта.\n" +
            "Если у тебя нет достаточной информации, укажи это в содержимом файла.\n" +
            "Не возвращай текстовый ответ, только вызовы create_file.";

        private const string DefaultAnalystPrompt = "Ты — аналитик требований. ...";
        private const string DefaultAnalystTTPrompt = "Ты — аналитик, генерирующий технические требования (ТТ) на основе исходных данных (ИД). ...";
        private const string DefaultAnalystAnalysisPrompt = "Ты — аналитик требований. На основе технических требований (ТТ) разработай три артефакта:\n" +
            "1. Анализ требований (АТ) — детализация требований, пользовательские сценарии, ограничения.\n" +
            "2. Риски (РИСК) — перечень рисков с оценкой вероятности и влияния.\n" +
            "3. Пользовательские истории (ПИ) — список user stories с критериями приёмки.\n\n" +
            "Для каждого артефакта вызови функцию create_file с соответствующим путём: DOCS/анализ/АТ_<...>.txt, DOCS/анализ/РИСК_<...>.txt, DOCS/анализ/ПИ_<...>.txt.\n" +
            "Содержимое должно быть текстовым, без обёрток кода.";

        private const string DefaultDeveloperPlanPrompt = 
            "Ты — технический руководитель проекта. На основе предоставленных архитектурных артефактов " +
            "(ИТ — используемые технологии, СП — структура проекта, СФС — структура файловой системы, ЭР — этапы разработки) " +
            "выполни декомпозицию работ на последовательный список задач для разработчика.\n\n" +
            "Требования к ответу:\n" +
            "1. Верни ТОЛЬКО JSON-массив без каких-либо пояснений.\n" +
            "2. Каждый элемент массива содержит поля 'title' (краткое название задачи) и 'description' (подробное описание).\n" +
            "3. Задачи должны идти в правильной технологической последовательности: от создания структуры до финальной сборки.\n" +
            "4. Количество задач — оптимальное (обычно 5–15), каждая должна быть атомарной и проверяемой.\n\n" +
            "Пример ответа:\n" +
            "[{\"title\":\"Создать структуру папок\",\"description\":\"...\"},{\"title\":\"...\",\"description\":\"...\"}]";

        private const string DefaultDeveloperTaskPrompt =
            "Ты — опытный разработчик. Тебе дана конкретная задача и контекст проекта (архитектурные артефакты).\n" +
            "Твоя цель — создать необходимые файлы для выполнения этой задачи.\n\n" +
            "Правила:\n" +
            "1. Используй функцию create_file для каждого создаваемого файла.\n" +
            "2. Пути указывай относительно корня проекта: src/ для исходного кода, config/ для конфигураций, docs/ для документации.\n" +
            "3. Содержимое файлов должно быть полным и готовым к использованию.\n" +
            "4. Не возвращай текстовый ответ, только вызовы create_file.\n" +
            "5. Если задача не требует создания файлов, верни пустой список вызовов.";

        private const string DefaultTesterPrompt =
            "Ты — тестировщик программного обеспечения. На основе предоставленных документов (АТ — анализ требований, " +
            "ПИ — пользовательские истории, КОД — исходный код, ДР — документация разработчика) подготовь три артефакта:\n" +
            "1. Тест-план (ТП) — стратегия тестирования, области покрытия, виды тестирования, критерии приёмки.\n" +
            "2. Тест-кейсы (ТК) — детальные сценарии проверки с шагами, ожидаемым и фактическим результатом.\n" +
            "3. Отчёт о тестировании (ОТ) — шаблон для фиксации результатов прогонов.\n\n" +
            "Для каждого артефакта вызови функцию create_file с путём в папке tests/: tests/test_plan.txt, tests/test_cases.txt, tests/test_report.txt.\n" +
            "Содержимое должно быть текстовым, без обёрток кода. Не возвращай текстовый ответ, только вызовы create_file.";

        public AssistantPromptService(AppDbContext context, ILogger<AssistantPromptService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Инициализирует промты по умолчанию, если они отсутствуют.
        /// </summary>
        private async Task EnsureDefaultPromptsExistAsync()
        {
            // Проверяем наличие промта для архитектора
            var architectExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Architect");
            if (!architectExists)
            {
                var prompt = new AssistantPrompt
                {
                    AssistantType = "Architect",
                    SystemPrompt = DefaultArchitectPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1 // системный пользователь
                };
                _context.AssistantPrompts.Add(prompt);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Добавлен системный промт для архитектора.");
            }

            var analystExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Analyst");
            if (!analystExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Analyst",
                    SystemPrompt = DefaultAnalystPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
            }

            var analystTTExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Analyst_TT");
            if (!analystTTExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Analyst_TT",
                    SystemPrompt = DefaultAnalystTTPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
            }

            // В методе EnsureDefaultPromptsExistAsync после добавления других промтов добавьте:
            var analystAnalysisExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Analyst_Analysis");
            if (!analystAnalysisExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Analyst_Analysis",
                    SystemPrompt = DefaultAnalystAnalysisPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Добавлен системный промт для аналитика (анализ).");
            }
            
            var developerPlanExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Developer_Plan");
            if (!developerPlanExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Developer_Plan",
                    SystemPrompt = DefaultDeveloperPlanPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Добавлен системный промт для декомпозиции разработчика.");
            }        

            var developerTaskExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Developer_Task");
            if (!developerTaskExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Developer_Task",
                    SystemPrompt = DefaultDeveloperTaskPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Добавлен системный промт для выполнения задачи разработчика.");
            }

            var testerExists = await _context.AssistantPrompts.AnyAsync(p => p.AssistantType == "Tester");
            if (!testerExists)
            {
                _context.AssistantPrompts.Add(new AssistantPrompt
                {
                    AssistantType = "Tester",
                    SystemPrompt = DefaultTesterPrompt,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = 1
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Добавлен системный промт для тестировщика.");
            }

            // При необходимости можно добавить промты для других ассистентов (пока оставляем пустыми)
            // Например, для Analyst, Developer, Tester
        }

        public async Task<AssistantPromptDto> GetPromptAsync(string assistantType)
        {
            /*
            var prompt = await _context.AssistantPrompts
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.AssistantType == assistantType);
            if (prompt == null)
                return null;
            return new AssistantPromptDto
            {
                Id = prompt.Id,
                AssistantType = prompt.AssistantType,
                SystemPrompt = prompt.SystemPrompt,
                UpdatedAt = prompt.UpdatedAt,
                UpdatedBy = prompt.UpdatedBy
            };
            */
            await EnsureDefaultPromptsExistAsync();

            var prompt = await _context.AssistantPrompts
                .Include(p => p.Updater)
                .FirstOrDefaultAsync(p => p.AssistantType == assistantType);

            if (prompt == null)
                throw new KeyNotFoundException($"Промт для ассистента '{assistantType}' не найден.");

            return MapToDto(prompt);
        }

        public async Task<List<AssistantPromptDto>> GetAllPromptsAsync()
        {
            await EnsureDefaultPromptsExistAsync();

            var prompts = await _context.AssistantPrompts
                .Include(p => p.Updater)
                .OrderBy(p => p.AssistantType)
                .ToListAsync();

            return prompts.Select(MapToDto).ToList();
        }

        public async Task<AssistantPromptDto> UpdatePromptAsync(string assistantType, UpdateAssistantPromptRequest request, int currentUserId)
        {
            if (string.IsNullOrWhiteSpace(request.SystemPrompt))
                throw new ArgumentException("Системный промт не может быть пустым.");

            var prompt = await _context.AssistantPrompts.FirstOrDefaultAsync(p => p.AssistantType == assistantType);
            if (prompt == null)
                throw new KeyNotFoundException($"Промт для ассистента '{assistantType}' не найден.");

            prompt.SystemPrompt = request.SystemPrompt;
            prompt.UpdatedAt = DateTime.UtcNow;
            prompt.UpdatedBy = currentUserId;

            await _context.SaveChangesAsync();

            // Загружаем навигационное свойство для DTO
            await _context.Entry(prompt).Reference(p => p.Updater).LoadAsync();

            _logger.LogInformation($"Обновлён промт для ассистента '{assistantType}' пользователем {currentUserId}");

            return MapToDto(prompt);
        }

        private AssistantPromptDto MapToDto(AssistantPrompt prompt)
        {
            return new AssistantPromptDto
            {
                Id = prompt.Id,
                AssistantType = prompt.AssistantType,
                SystemPrompt = prompt.SystemPrompt,
                UpdatedByUsername = prompt.Updater?.Username,
                UpdatedAt = prompt.UpdatedAt
            };
        }
    }
}