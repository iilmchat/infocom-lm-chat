# tools/cleanup.ps1
# Уборка Infocom LM Chat Pro перед публикацией на GitHub.
#
# Принцип: архивируем ВСЁ, что имеет историческую ценность.
# Удаляем только пустые файлы и точные дубликаты, которые уже
# перенесены в новое место.
#
# Запуск:
#   powershell -ExecutionPolicy Bypass -File tools\cleanup.ps1           # dry-run
#   powershell -ExecutionPolicy Bypass -File tools\cleanup.ps1 -Apply    # применить

param(
    [switch]$Apply = $false,
    [switch]$SkipBackup = $false
)

$ErrorActionPreference = 'Continue'
$root = (Get-Location).Path

if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "❌ Запустите из корня проекта (нет index.html)" -ForegroundColor Red
    exit 1
}

# ============================================================
# БЭКАП
# ============================================================
if ($Apply -and -not $SkipBackup) {
    $bak = Join-Path (Split-Path $root -Parent) "infocom-lm-chat-backup-$(Get-Date -Format 'yyyy-MM-dd-HHmm').zip"
    Write-Host "📦 Создаю бэкап: $bak" -ForegroundColor Cyan
    Compress-Archive -Path (Join-Path $root '*') -DestinationPath $bak -Force
    Write-Host "✅ Бэкап создан" -ForegroundColor Green
}

# ============================================================
# КАТЕГОРИИ
# ============================================================

# --- A. → tools/ ---
$movesToTools = [ordered]@{
    'build-archive.mjs'        = 'tools/build-archive.mjs'
    'create-structure.bat'     = 'tools/archive/create-structure.bat'
    'Node.js (live-server).sh' = 'tools/scripts/start-live-server.sh'
    'Python.sh'                = 'tools/scripts/start-python.sh'
}

# --- B. → docs/ (актуальные документы) ---
$movesToDocs = [ordered]@{
    'docs/Infocom_API_Reference.txt' = 'docs/API.md'
    'project.md'                     = 'docs/PROJECT_OVERVIEW.md'
}

# --- C. → docs/archive/snapshots/ ---
$movesToSnapshots = [ordered]@{
    '01_core.txt'       = 'docs/archive/snapshots/01_core.txt'
    '02_modules.txt'    = 'docs/archive/snapshots/02_modules.txt'
    '03_ui_styles.txt'  = 'docs/archive/snapshots/03_ui_styles.txt'
    '04_services.txt'   = 'docs/archive/snapshots/04_services.txt'
    '05_models.txt'     = 'docs/archive/snapshots/05_models.txt'
}

# --- D. → docs/archive/structure/ ---
$movesToStructure = [ordered]@{
    'structure.txt'      = 'docs/archive/structure/structure.txt'
    'structure_full.txt' = 'docs/archive/structure/structure_full.txt'
    'structure_old.txt'  = 'docs/archive/structure/structure_old.txt'
}

# --- E. → docs/archive/html-snapshots/ ---
$movesToHtml = [ordered]@{
    'Infocom LM Chat.html' = 'docs/archive/html-snapshots/Infocom LM Chat.html'
}

# --- F. → docs/archive/legacy/ (legacy-код с историей) ---
$movesToLegacy = [ordered]@{
    # syntax-highlighter (большая работа, заменена markdownService в 5.2)
    'src/services/syntax-highlighter.js'              = 'docs/archive/legacy/syntax-highlighter/syntax-highlighter.js'
    'src/services/syntax-highlighter.worker.js'       = 'docs/archive/legacy/syntax-highlighter/worker.js'
    'src/services/syntax-highlighter_main.js'         = 'docs/archive/legacy/syntax-highlighter/main.js'
    'src/services/syntax-highlighter-cache.js'        = 'docs/archive/legacy/syntax-highlighter/cache.js'
    'src/services/syntax-highlighter-optimizations.js'= 'docs/archive/legacy/syntax-highlighter/optimizations.js'
    'src/hooks/useSyntaxHighlight.js'                 = 'docs/archive/legacy/syntax-highlighter/useSyntaxHighlight.js'

    # Legacy модалки (заменены ProfileModal в 5.3)
    'src/ui/views/auth-modal.js'                      = 'docs/archive/legacy/modals/auth-modal.js'
    'src/ui/views/user-modal.js'                      = 'docs/archive/legacy/modals/user-modal.js'

    # network-helpers (черновики и история)
    'src/utils/network-helpers.js.txt'                = 'docs/archive/legacy/network-helpers/network-helpers.js.txt'
    'src/utils/network-helpers_new.js'                = 'docs/archive/legacy/network-helpers/network-helpers_new.js'
    'src/utils/network-helpers_new.js.txt'            = 'docs/archive/legacy/network-helpers/network-helpers_new.js.txt'
    'src/utils/network-helpers_old.js'                = 'docs/archive/legacy/network-helpers/network-helpers_old.js'

    # Legacy test-runner
    'src/utils/test-runner_Old.js'                    = 'docs/archive/legacy/test-runner_Old.js'

    # Дубликат модели
    'src/models/ses.js'                               = 'docs/archive/legacy/models/ses.js'

    # React в vanilla-JS проекте
    'src/components/CodeEditor.jsx'                   = 'docs/archive/legacy/CodeEditor.jsx'
}

# --- G. → vendor/ ---
$movesToVendor = [ordered]@{
    'src/components/highlight.min.js'       = 'vendor/highlight.min.js'
    'src/components/marked.min.js'          = 'vendor/marked.min.js'
    'src/components/marked.esm.js'          = 'vendor/marked.esm.js'
    'src/components/purify.min.js'          = 'vendor/purify.min.js'
    'src/components/purify.es.mjs'          = 'vendor/purify.es.mjs'
    'src/components/mammoth.browser.min.js' = 'vendor/mammoth.browser.min.js'
    'src/components/html2pdf.bundle.min.js' = 'vendor/html2pdf.bundle.min.js'
    'src/components/pdf.min.js'             = 'vendor/pdf.min.js'
    'src/components/pdf.min.mjs'            = 'vendor/pdf.min.mjs'
    'src/components/pdf.worker.min.mjs'     = 'vendor/pdf.worker.min.mjs'
    'src/components/pdf_viewer.min.css'     = 'vendor/pdf_viewer.min.css'
    'src/components/signalr.min.js'         = 'vendor/signalr.min.js'
    'src/styles/atom-one-dark.min.css'      = 'vendor/atom-one-dark.min.css'
}

# --- H. → docs/archive/mini-metro/ (итерации разработки) ---
$updatesSrc = 'updates'
$updatesDst = 'docs/archive/mini-metro'

# --- I. УДАЛИТЬ безвозвратно (только пустышки и точные дубликаты нового места) ---
$toDelete = @(
    # Пустые файлы
    'docs/miniMetro_documentation.md',      # 0 B
    'docs/Обновление SyntaxHighlighter.txt',# 0 B

    # Дубликаты локалей (заменены на /locales/*.js в v6.2)
    'src/locales/ru.json',
    'src/locales/en.json',

    # Устаревшие версии MiniMetro (есть финальная src/games/mini-metro.js
    # и полная история в docs/archive/mini-metro/)
    'src/games/mini-metro_old.js',
    'src/games/mini-metro_old1.js',

    # Файлы-заглушки с русскими именами (не код, а заметки)
    'src/modules/admin/В app.js будем загружать этот модуль динамически.js',
    'src/modules/games/В app.js'
)

# --- J. Пустые директории ---
$dirsToRemoveIfEmpty = @(
    'src/components',
    'src/hooks',
    'src/locales'
)

# ============================================================
# ХЕЛПЕРЫ
# ============================================================

function Test-Exists($rel) {
    Test-Path (Join-Path $root $rel)
}

function Ensure-Dir($dir) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

function Move-Safe($srcRel, $dstRel) {
    $src = Join-Path $root $srcRel
    $dst = Join-Path $root $dstRel
    if (-not (Test-Path $src)) { return $false }
    Ensure-Dir (Split-Path $dst -Parent)
    Move-Item -Path $src -Destination $dst -Force
    return $true
}

# ============================================================
# ПЛАН (dry-run)
# ============================================================

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " ПЛАН УБОРКИ (dry-run)" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

function Show-Moves($label, $map) {
    Write-Host "▶ $label" -ForegroundColor Cyan
    $n = 0
    $map.GetEnumerator() | ForEach-Object {
        if (Test-Exists $_.Key) {
            Write-Host "   $($_.Key)  →  $($_.Value)"
            $n++
        }
    }
    if ($n -eq 0) { Write-Host "   (нет файлов)" -ForegroundColor DarkGray }
    Write-Host ""
}

Show-Moves "A. → tools/ ($($movesToTools.Count) шт.)"              $movesToTools
Show-Moves "B. → docs/ ($($movesToDocs.Count) шт.)"                $movesToDocs
Show-Moves "C. → docs/archive/snapshots/"                          $movesToSnapshots
Show-Moves "D. → docs/archive/structure/"                          $movesToStructure
Show-Moves "E. → docs/archive/html-snapshots/"                     $movesToHtml
Show-Moves "F. → docs/archive/legacy/ (legacy-код)"                $movesToLegacy
Show-Moves "G. → vendor/"                                          $movesToVendor

Write-Host "▶ H. updates/MiniMetro/ → $updatesDst/" -ForegroundColor Cyan
if (Test-Path (Join-Path $root $updatesSrc)) {
    $cnt = (Get-ChildItem (Join-Path $root $updatesSrc) -Recurse -File | Measure-Object).Count
    Write-Host "   $cnt файлов"
} else { Write-Host "   (нет)" -ForegroundColor DarkGray }
Write-Host ""

Write-Host "▶ I. Удалить безвозвратно" -ForegroundColor Red
$toDelete | Where-Object { Test-Exists $_ } | ForEach-Object {
    Write-Host "   🗑️  $_"
}
Write-Host ""

Write-Host "▶ J. Удалить пустые директории" -ForegroundColor DarkGray
$dirsToRemoveIfEmpty | ForEach-Object {
    if (Test-Exists $_) {
        $items = Get-ChildItem (Join-Path $root $_) -Force -ErrorAction SilentlyContinue
        if (-not $items) { Write-Host "   🗑️  $_/ (пусто)" }
        else { Write-Host "   ⚠️  $_/ не пуст, оставлен ($($items.Count) шт.)" -ForegroundColor Yellow }
    }
}
Write-Host ""

Write-Host "▶ ✅ ОСТАВЛЯЕМ на месте:" -ForegroundColor Green
Write-Host "   web.config   (IIS:8033)"
Write-Host "   index.html, package.json, README.md, CHANGELOG.md, CONTRIBUTING.md"
Write-Host "   .gitignore, .editorconfig"
Write-Host "   src/ (без legacy), locales/, tests/, tools/inventory.ps1, tools/cleanup.ps1"
Write-Host ""

if (-not $Apply) {
    Write-Host "⚠️  DRY-RUN. Ничего не изменено." -ForegroundColor Yellow
    Write-Host "   Применить:  powershell -ExecutionPolicy Bypass -File tools\cleanup.ps1 -Apply" -ForegroundColor Yellow
    exit 0
}

# ============================================================
# ПРИМЕНЕНИЕ
# ============================================================

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ПРИМЕНЯЮ" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

function Apply-Moves($label, $map) {
    Write-Host "▶ $label" -ForegroundColor Cyan
    $n = 0
    foreach ($kv in $map.GetEnumerator()) {
        if (Move-Safe $kv.Key $kv.Value) {
            Write-Host "   ✓ $($kv.Key) → $($kv.Value)" -ForegroundColor Cyan
            $n++
        }
    }
    Write-Host "   Перемещено: $n" -ForegroundColor Cyan
    Write-Host ""
}

Apply-Moves "A. → tools/"                  $movesToTools
Apply-Moves "B. → docs/"                   $movesToDocs
Apply-Moves "C. → docs/archive/snapshots/" $movesToSnapshots
Apply-Moves "D. → docs/archive/structure/" $movesToStructure
Apply-Moves "E. → docs/archive/html-snapshots/" $movesToHtml
Apply-Moves "F. → docs/archive/legacy/"    $movesToLegacy
Apply-Moves "G. → vendor/"                 $movesToVendor

# H. updates/
Write-Host "▶ H. updates/ → $updatesDst/" -ForegroundColor Cyan
$updSrcPath = Join-Path $root $updatesSrc
if (Test-Path $updSrcPath) {
    $updDstPath = Join-Path $root $updatesDst
    Ensure-Dir $updDstPath
    Get-ChildItem $updSrcPath -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($updSrcPath.Length).TrimStart('\','/')
        $flat = $rel -replace '[\\/]', '_'
        Move-Item -Path $_.FullName -Destination (Join-Path $updDstPath $flat) -Force
    }
    Remove-Item -Path $updSrcPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ updates/ → $updatesDst/" -ForegroundColor Cyan
} else { Write-Host "   (нет)" -ForegroundColor DarkGray }
Write-Host ""

# I. Удаление
Write-Host "▶ I. Удаление" -ForegroundColor Red
$n = 0
foreach ($f in $toDelete) {
    $p = Join-Path $root $f
    if (Test-Path $p) {
        Remove-Item -Path $p -Force -ErrorAction SilentlyContinue
        Write-Host "   🗑️  $f" -ForegroundColor DarkRed
        $n++
    }
}
Write-Host "   Удалено: $n" -ForegroundColor Red
Write-Host ""

# J. Пустые директории
Write-Host "▶ J. Пустые директории" -ForegroundColor DarkGray
foreach ($d in $dirsToRemoveIfEmpty) {
    $p = Join-Path $root $d
    if (Test-Path $p) {
        $items = Get-ChildItem $p -Force -ErrorAction SilentlyContinue
        if (-not $items) {
            Remove-Item $p -Force
            Write-Host "   🗑️  $d/" -ForegroundColor DarkGray
        } else {
            Write-Host "   ⚠️  $d/ не пуст ($($items.Count) шт.), оставлен" -ForegroundColor Yellow
        }
    }
}
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✅ ОЧИСТКА ЗАВЕРШЕНА" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  СЛЕДУЮЩИЕ ШАГИ:" -ForegroundColor Yellow
Write-Host ""
Write-Host " 1. Обновить пути в index.html:"
Write-Host "      src/styles/atom-one-dark.min.css  →  vendor/atom-one-dark.min.css"
Write-Host "      src/components/*.min.js            →  vendor/*.min.js"
Write-Host "      /src/components/html2pdf.bundle.min.js  →  vendor/html2pdf.bundle.min.js"
Write-Host ""
Write-Host " 2. Проверить, что приложение запускается (консоль чистая)"
Write-Host ""
Write-Host " 3. Обновить .gitignore (см. ниже в отчёте)"
Write-Host ""
Write-Host " 4. Обновить docs/KNOWN_ISSUES.md (KI-016…KI-023)"
Write-Host ""