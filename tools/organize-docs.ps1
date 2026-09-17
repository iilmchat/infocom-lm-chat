# tools\organize-docs.ps1
param([switch]$Apply = $false)

$root = (Get-Location).Path
$docs = Join-Path $root 'docs'

$moves = @(
    # API
    @{ Src = 'docs\Infocom_API_Reference.txt'; Dst = 'docs\API.md' },

    # Archive: MiniMetro
    @{ Src = 'docs\MiniMetro Итог Спринта 8.txt';      Dst = 'docs\archive\mini-metro\sprint-8-summary.txt' },
    @{ Src = 'docs\MiniMetro Пояснения к ключевым алгоритмам.txt'; Dst = 'docs\archive\mini-metro\algorithms.txt' },
    @{ Src = 'docs\MiniMetro Что изменилось в Спринте 7.txt';      Dst = 'docs\archive\mini-metro\sprint-7-changes.txt' },
    @{ Src = 'docs\Интеграция Mini Metro в проект Infocom LM Chat Pro v6.1.txt'; Dst = 'docs\archive\mini-metro\integration-v6.1.txt' },
    @{ Src = 'docs\Примечания по реализации MiniMetro.txt';        Dst = 'docs\archive\mini-metro\notes.txt' },
    @{ Src = 'docs\Что исправлено в движении поездов.txt';         Dst = 'docs\archive\mini-metro\train-movement-fix.txt' },
    @{ Src = 'docs\Проект ТЗ на MiniMetro.txt';                    Dst = 'docs\planning\MINIMETRO_SPEC.md' },

    # Archive: v5.2 / v5.3 / v6.x
    @{ Src = 'docs\Все изменения для версии 5.2 представлены.txt'; Dst = 'docs\archive\v5.2\summary.txt' },
    @{ Src = 'docs\Краткое резюме изменений chat-view.txt';       Dst = 'docs\archive\v5.2\chat-view.txt' },
    @{ Src = 'docs\Краткое резюме изменений session-manager.txt'; Dst = 'docs\archive\v5.2\session-manager.txt' },
    @{ Src = 'docs\Краткое резюме изменений syntaxHighlighter.txt'; Dst = 'docs\archive\v5.2\syntax-highlighter-removal.txt' },
    @{ Src = 'docs\Краткое резюме измененийapi-service.txt';      Dst = 'docs\archive\v5.2\api-service.txt' },
    @{ Src = 'docs\Основные изменения getMessagesWithHighlight.txt'; Dst = 'docs\archive\v5.2\get-messages-with-highlight.txt' },
    @{ Src = 'docs\Инструкция по интеграции в 5.3.txt';           Dst = 'docs\archive\v5.3\integration.txt' },
    @{ Src = 'docs\Теперь проект готов к переходу на v5.3.txt';   Dst = 'docs\archive\v5.3\ready-for-v5.3.txt' },
    @{ Src = 'docs\Итоговые изменения section-toggle.txt';        Dst = 'docs\archive\v5.3\section-toggle.txt' },
    @{ Src = 'docs\Изменения в 13.txt';                           Dst = 'docs\archive\v6.x\changes-13.txt' },
    @{ Src = 'docs\ИТОГ 13.txt';                                  Dst = 'docs\archive\v6.x\summary-13.txt' },

    # Archive: architecture notes (свод пойдёт в ARCHITECTURE.md отдельно)
    @{ Src = 'docs\Архитектура модулей.txt';                     Dst = 'docs\archive\architecture\modules.txt' },
    @{ Src = 'docs\Архитектура после изменений.txt';              Dst = 'docs\archive\architecture\after-changes.txt' },
    @{ Src = 'docs\Обновленная архитектура портов.txt';           Dst = 'docs\archive\architecture\ports.txt' },
    @{ Src = 'docs\Обновленная архитектура приватных чатов.txt';  Dst = 'docs\archive\architecture\private-chats.txt' },
    @{ Src = 'docs\Итоговая структура файлов.txt';                Dst = 'docs\archive\architecture\structure.txt' },
    @{ Src = 'docs\Полная структура проекта (ключевые файлы и папки).txt'; Dst = 'docs\archive\architecture\structure-full.txt' },

    # Archive: misc
    @{ Src = 'docs\RAG (векторный поиск).txt';                   Dst = 'docs\archive\misc\rag.txt' },
    @{ Src = 'docs\Изменения copyToClipboard.txt';               Dst = 'docs\archive\misc\copy-to-clipboard.txt' },
    @{ Src = 'docs\Как ES-модуль.html';                          Dst = 'docs\archive\misc\es-module.html' },
    @{ Src = 'docs\Как обычный скрипт.html';                     Dst = 'docs\archive\misc\regular-script.html' },
    @{ Src = 'docs\Пример подключения в HTML.html';              Dst = 'docs\archive\misc\html-example.html' },
    @{ Src = 'docs\Открытие клиента.txt';                        Dst = 'docs\archive\misc\client-open.txt' },
    @{ Src = 'docs\Отправка сообщения.txt';                      Dst = 'docs\archive\misc\send-message.txt' },
    @{ Src = 'docs\Теперь структура проекта включает все компоненты для полноценной работы Drag-and-Drop.txt'; Dst = 'docs\archive\misc\drag-and-drop.txt' },

    # Planning
    @{ Src = 'docs\План дальнейшей разработки Infocom LM Chat Pro v6.1.txt'; Dst = 'docs\planning\ROADMAP.md' },
    @{ Src = 'docs\Общий план доработок.txt';                    Dst = 'docs\archive\planning\general-todo.txt' },

    # Пустые — удалить
    @{ Src = 'docs\miniMetro_documentation.md';                  Dst = $null },
    @{ Src = 'docs\Обновление SyntaxHighlighter.txt';            Dst = $null },

    # Дубликат (уже есть "Итог Спринта 8.txt" — он был скопирован)
    @{ Src = 'docs\Итог Спринта 8.txt';                          Dst = $null },
    @{ Src = 'docs\Пояснения к ключевым алгоритмам.txt';         Dst = $null },
    @{ Src = 'docs\Что изменилось в Спринте 7.txt';              Dst = $null }
)

Write-Host "=== ПЛАН РАСКЛАДКИ DOCS ===" -ForegroundColor Yellow
$existing = $moves | Where-Object { Test-Path (Join-Path $root $_.Src) }
Write-Host "Найдено к обработке: $($existing.Count) из $($moves.Count)"
$existing | ForEach-Object {
    $d = if ($_.Dst) { $_.Dst } else { '(DELETE)' }
    Write-Host "   $($_.Src)  →  $d"
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "⚠️  DRY-RUN. Запустите с -Apply для применения." -ForegroundColor Yellow
    exit 0
}

foreach ($m in $moves) {
    $src = Join-Path $root $m.Src
    if (-not (Test-Path $src)) { continue }

    if ($null -eq $m.Dst) {
        Remove-Item $src -Force
        Write-Host "   🗑️  $($m.Src)" -ForegroundColor DarkRed
        continue
    }

    $dst = Join-Path $root $m.Dst
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Move-Item -Path $src -Destination $dst -Force
    Write-Host "   📁 $($m.Src) → $($m.Dst)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Раскладка docs/ завершена" -ForegroundColor Green