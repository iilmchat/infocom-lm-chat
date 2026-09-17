# tools/inventory.ps1
# Инвентаризация проекта Infocom LM Chat Pro
# Совместимо с PowerShell 5.1 и 7+
# Запуск: powershell -ExecutionPolicy Bypass -File tools/inventory.ps1

param(
    [string]$Root = ".",
    [string]$OutFile = "project-inventory.txt"
)

$ErrorActionPreference = 'Continue'
$rootPath = (Resolve-Path $Root).Path
$report = New-Object System.Collections.Generic.List[string]

function Add-Line($text = "") { $report.Add([string]$text) | Out-Null }

Add-Line "=================================================================================="
Add-Line " Infocom LM Chat Pro - Inventory"
Add-Line " Root:  $rootPath"
Add-Line " Date:  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line "=================================================================================="
Add-Line ""

$excludeDirs = @('node_modules', '.git', '.vscode', '.idea', 'dist', 'build', '.cache')

$files = Get-ChildItem -Path $rootPath -Recurse -File -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $rel = $_.FullName.Substring($rootPath.Length).TrimStart('\','/')
        $parts = $rel -split '[\\/]'
        -not ($parts | Where-Object { $excludeDirs -contains $_ })
    }

# --- 1. Сводка по расширениям ---
Add-Line "--- 1. SUMMARY BY EXTENSION ------------------------------------------------------"
Add-Line ""
$byExt = $files | Group-Object {
    $e = $_.Extension.ToLower()
    if ([string]::IsNullOrEmpty($e)) { '(no ext)' } else { $e }
} | Sort-Object Count -Descending

Add-Line ("{0,-14} {1,6} {2,16}" -f "Ext", "Count", "TotalSize")
Add-Line ("{0,-14} {1,6} {2,16}" -f "---", "-----", "---------")
$totalSize = 0
foreach ($g in $byExt) {
    $size = ($g.Group | Measure-Object -Property Length -Sum).Sum
    $totalSize += $size
    Add-Line ("{0,-14} {1,6} {2,16}" -f $g.Name, $g.Count, ("{0:N0} B" -f $size))
}
Add-Line ("{0,-14} {1,6} {2,16}" -f "TOTAL", $files.Count, ("{0:N0} B" -f $totalSize))
Add-Line ""

# --- 2. Дерево файлов ---
Add-Line "--- 2. FILES TREE ---------------------------------------------------------------"
Add-Line ""
$textExts = @('.js','.json','.css','.html','.md','.txt','.ps1','.sh','.yml','.yaml','.xml','.svg','.editorconfig')
foreach ($f in ($files | Sort-Object FullName)) {
    $rel = $f.FullName.Substring($rootPath.Length).TrimStart('\','/')
    $size = "{0,10:N0} B" -f $f.Length
    if ($textExts -contains $f.Extension.ToLower()) {
        try {
            $lc = (Get-Content -Path $f.FullName -ErrorAction SilentlyContinue | Measure-Object).Count
            Add-Line ("{0}  {1,7} L  {2}" -f $size, $lc, $rel)
        } catch {
            Add-Line ("{0}  {1,7}    {2}" -f $size, "?", $rel)
        }
    } else {
        Add-Line ("{0}  {1,7}    {2}" -f $size, "bin", $rel)
    }
}
Add-Line ""

# --- 3. Крупные файлы ---
Add-Line "--- 3. BIG FILES (>50 KB) -------------------------------------------------------"
Add-Line ""
$big = $files | Where-Object { $_.Length -gt 50KB } | Sort-Object Length -Descending
if ($big) {
    foreach ($f in $big) {
        $rel = $f.FullName.Substring($rootPath.Length).TrimStart('\','/')
        Add-Line ("  {0,10:N0} B  {1}" -f $f.Length, $rel)
    }
} else { Add-Line "  (none)" }
Add-Line ""

# --- 4. Подозрительные файлы ---
Add-Line "--- 4. SUSPICIOUS FILES ---------------------------------------------------------"
Add-Line ""
$suspicious = $files | Where-Object {
    $_.Name -match '(\.bak$|\.old$|\.orig$|~$|\.tmp$|\.log$|syntax-highlighter|\.DS_Store|Thumbs\.db)'
}
if ($suspicious) {
    foreach ($f in $suspicious) {
        $rel = $f.FullName.Substring($rootPath.Length).TrimStart('\','/')
        Add-Line ("  - {0}" -f $rel)
    }
} else { Add-Line "  (none)" }
Add-Line ""

# --- 5. Архивные .txt (снапшоты) ---
Add-Line "--- 5. ARCHIVE SNAPSHOTS (*.txt in root) ----------------------------------------"
Add-Line ""
$snaps = $files | Where-Object {
    $_.DirectoryName -eq $rootPath -and $_.Extension -eq '.txt'
}
if ($snaps) {
    foreach ($f in $snaps) {
        Add-Line ("  - {0}  ({1:N0} B)" -f $f.Name, $f.Length)
    }
} else { Add-Line "  (none)" }
Add-Line ""

# --- 6. Vendor libs в src/components ---
Add-Line "--- 6. VENDOR LIBS under src/components/ (candidate: move to vendor/) ----------"
Add-Line ""
$vendor = $files | Where-Object { $_.FullName -match '\\src\\components\\' }
if ($vendor) {
    foreach ($f in $vendor) {
        $rel = $f.FullName.Substring($rootPath.Length).TrimStart('\','/')
        Add-Line ("  {0,10:N0} B  {1}" -f $f.Length, $rel)
    }
} else { Add-Line "  (none)" }
Add-Line ""

# --- 7. Стандартные файлы ---
Add-Line "--- 7. STANDARD FILES CHECK -----------------------------------------------------"
Add-Line ""
$standard = @('.gitignore','README.md','LICENSE','.editorconfig','CHANGELOG.md','CONTRIBUTING.md','package.json')
foreach ($name in $standard) {
    if (Test-Path (Join-Path $rootPath $name)) {
        Add-Line ("  [OK]      {0}" -f $name)
    } else {
        Add-Line ("  [MISSING] {0}" -f $name)
    }
}
foreach ($d in @('docs','tests','tools','vendor','locales','src')) {
    if (Test-Path (Join-Path $rootPath $d)) { Add-Line ("  [OK dir]  {0}/" -f $d) }
    else { Add-Line ("  [MISSING] {0}/" -f $d) }
}
Add-Line ""

# --- 8. Содержимое docs/ ---
Add-Line "--- 8. docs/ CONTENTS -----------------------------------------------------------"
Add-Line ""
if (Test-Path (Join-Path $rootPath 'docs')) {
    Get-ChildItem (Join-Path $rootPath 'docs') -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring((Join-Path $rootPath 'docs').Length).TrimStart('\','/')
        Add-Line ("  {0,10:N0} B  docs/{1}" -f $_.Length, $rel)
    }
} else { Add-Line "  (no docs/)" }
Add-Line ""

# --- 9. locales/ ---
Add-Line "--- 9. locales/ CONTENTS --------------------------------------------------------"
Add-Line ""
if (Test-Path (Join-Path $rootPath 'locales')) {
    Get-ChildItem (Join-Path $rootPath 'locales') -File | ForEach-Object {
        Add-Line ("  {0,10:N0} B  {1}" -f $_.Length, $_.Name)
    }
} else { Add-Line "  (no locales/)" }
Add-Line ""

# --- 10. Импорты из index.html ---
Add-Line "--- 10. <script src> / <link href> in index.html --------------------------------"
Add-Line ""
$idx = Join-Path $rootPath 'index.html'
if (Test-Path $idx) {
    $html = Get-Content $idx -Raw
    $matches = [regex]::Matches($html, '(src|href)\s*=\s*"([^"]+)"')
    $seen = @{}
    foreach ($m in $matches) {
        $url = $m.Groups[2].Value
        if ($seen.ContainsKey($url)) { continue }
        $seen[$url] = $true
        $exists = $false
        if ($url -notmatch '^(https?:|//|data:|#)') {
            $probe = Join-Path $rootPath ($url.TrimStart('/'))
            $exists = Test-Path $probe
        }
        $status = '???'
        if ($url -match '^(https?:|//)') { $status = 'EXT' }
        elseif ($exists) { $status = 'OK' }
        Add-Line ("  [{0}] {1}" -f $status, $url)
    }
} else { Add-Line "  (no index.html)" }
Add-Line ""

# --- Конец ---
Add-Line "=================================================================================="
Add-Line " END OF REPORT"
Add-Line "=================================================================================="

# Пишем в файл (совместимо с PS 5.1: Out-File -Encoding utf8)
$reportText = $report -join "`r`n"
$reportText | Out-File -FilePath $OutFile -Encoding utf8

# И показываем в консоли
Write-Output $reportText

Write-Host ""
Write-Host "Report saved to: $OutFile" -ForegroundColor Green