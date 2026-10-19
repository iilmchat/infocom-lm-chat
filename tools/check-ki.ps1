# tools/check-ki.ps1
# Проверка «зомби-KI» в docs/KNOWN_ISSUES.md
# Запуск: pwsh -File tools/check-ki.ps1

param(
    [string]$FilePath = "docs/KNOWN_ISSUES.md",
    [switch]$Strict = $false
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $FilePath)) {
    Write-Host "❌ Файл не найден: $FilePath" -ForegroundColor Red
    exit 1
}

$content = Get-Content $FilePath -Raw -Encoding UTF8

# 1. Общее количество KI (заголовки "## KI-XXX" или "### KI-XXX")
$totalPattern = '(?m)^#{2,3}\s+KI-\d+'
$total = ([regex]::Matches($content, $totalPattern)).Count

if ($total -eq 0) {
    Write-Host "❌ Не найдено ни одного KI-заголовка" -ForegroundColor Red
    Write-Host "   Ожидаемый формат: '## KI-XXX — ...' или '### KI-XXX — ...'" -ForegroundColor Yellow
    exit 1
}

# 2. Распределение по статусам
$statuses = @(
    'Fixed',
    'In Progress',
    'Open',
    'Documented',
    'Deferred',
    "Won't Fix"
)

$results = [ordered]@{}
foreach ($status in $statuses) {
    # Ищем "**Статус:** StatusName" в начале строки; допускаем "(v6.2)" и pipe.
    # (?m) обязателен: без него $ совпадает только с концом всего файла.
    $pattern = '(?m)^\s*-\s*\*\*Статус:\*\*\s+' + [regex]::Escape($status) + '(?=\s*(?:\(|\r?$|\|))'
    $count = ([regex]::Matches($content, $pattern)).Count
    $results[$status] = $count
    Write-Host ("{0,-15}: {1}" -f $status, $count) -ForegroundColor Cyan
}

$sum = ($results.Values | Measure-Object -Sum).Sum

# 3. Сверка
Write-Host "---------------------------------" -ForegroundColor DarkGray
Write-Host "Всего заголовков: $total" -ForegroundColor White
Write-Host "Сумма статусов:   $sum" -ForegroundColor White

if ($total -ne $sum) {
    $diff = $total - $sum
    Write-Host ""
    Write-Host "⚠️  РАСХОЖДЕНИЕ: $diff KI без корректного статуса" -ForegroundColor Yellow
    Write-Host "   Возможные причины:" -ForegroundColor Yellow
    Write-Host "   - Заголовок есть, но нет '**Статус:** ...' внутри" -ForegroundColor Yellow
    Write-Host "   - Опечатка в статусе (например, 'Open ' с пробелом)" -ForegroundColor Yellow
    Write-Host "   - Дубль KI-ID" -ForegroundColor Yellow

    # 4. Найти KI без статуса
    $kiHeaders = [regex]::Matches($content, '(?m)^#{2,3}\s+(KI-\d+)[^\n]*')
    $missingStatus = @()
    foreach ($m in $kiHeaders) {
        $kiId = $m.Groups[1].Value
        # Ищем блок до следующего KI или до конца файла
        $startIdx = $m.Index
        $nextKi = [regex]::Match($content.Substring($startIdx + $m.Length), '(?m)^#{2,3}\s+KI-\d+')
        $endIdx = if ($nextKi.Success) { $startIdx + $m.Length + $nextKi.Index } else { $content.Length }
        $block = $content.Substring($startIdx, $endIdx - $startIdx)

        if ($block -notmatch '\*\*Статус:\*\*') {
            $missingStatus += $kiId
        }
    }
    if ($missingStatus.Count -gt 0) {
        Write-Host ""
        Write-Host "KI без статуса: $($missingStatus -join ', ')" -ForegroundColor Yellow
    }

    if ($Strict) {
        Write-Host ""
        Write-Host "❌ Строгий режим: выход с ошибкой" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "✅ Всё сходится" -ForegroundColor Green
}

# 5. Дополнительные проверки
Write-Host ""
Write-Host "--- Дополнительные проверки ---" -ForegroundColor Cyan

# 5.1. Дубликаты KI-ID
$allIds = [regex]::Matches($content, '(?m)^#{2,3}\s+(KI-\d+)') | ForEach-Object { $_.Groups[1].Value }
$dups = $allIds | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dups) {
    Write-Host "⚠️  Дубликаты KI-ID:" -ForegroundColor Yellow
    $dups | ForEach-Object { Write-Host "   $($_.Name) — $($_.Count) раза" -ForegroundColor Yellow }
} else {
    Write-Host "✅ Нет дубликатов KI-ID" -ForegroundColor Green
}

# 5.2. Fixed без "Исправлено в"
$fixedBlocks = [regex]::Matches($content, '(?ms)^#{2,3}\s+(KI-\d+)[^\n]*\n(.*?)(?=^#{2,3}\s+KI-|\Z)')
$fixedWithoutVersion = @()
foreach ($fb in $fixedBlocks) {
    $block = $fb.Value
    if ($block -match '\*\*Статус:\*\*\s+Fixed' -and $block -notmatch '\*\*Исправлено в:\*\*') {
        $fixedWithoutVersion += $fb.Groups[1].Value
    }
}
if ($fixedWithoutVersion.Count -gt 0) {
    Write-Host "⚠️  Fixed без '**Исправлено в:**':" -ForegroundColor Yellow
    Write-Host "   $($fixedWithoutVersion -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "✅ Все Fixed имеют версию исправления" -ForegroundColor Green
}

# 5.3. Open с "Исправлено в"
$openBlocks = [regex]::Matches($content, '(?ms)^#{2,3}\s+(KI-\d+)[^\n]*\n(.*?)(?=^#{2,3}\s+KI-|\Z)')
$openWithVersion = @()
foreach ($ob in $openBlocks) {
    $block = $ob.Value
    if ($block -match '\*\*Статус:\*\*\s+Open' -and $block -match '\*\*Исправлено в:\*\*') {
        $openWithVersion += $ob.Groups[1].Value
    }
}
if ($openWithVersion.Count -gt 0) {
    Write-Host "⚠️  Open с '**Исправлено в:**' (подозрительно):" -ForegroundColor Yellow
    Write-Host "   $($openWithVersion -join ', ')" -ForegroundColor Yellow
} else {
    Write-Host "✅ Нет Open с версией исправления" -ForegroundColor Green
}

Write-Host ""
Write-Host "Готово." -ForegroundColor Green
