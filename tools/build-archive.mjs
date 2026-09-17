// build-archive.mjs
// Собирает исходники в 5 .txt-файлов для передачи в чат.
// Запуск: node build-archive.mjs

import fs from 'fs';
import path from 'path';

const GROUPS = {
  '01_core.txt': [
    'index.html',
    'src/app.js',
    'src/core/router.js',
    'src/core/event-bus.js',
    'src/config.js'
  ],

  '02_modules.txt': [
    'src/modules/chat/ChatModule.js',
    'src/modules/private/PrivateChatModule.js',
    'src/modules/profile/ProfileModule.js',
    'src/modules/settings/SettingsModule.js',
    'src/modules/stats/StatsModule.js',
    'src/modules/admin/AdminModule.js',
    'src/modules/games/GamesModule.js'
  ],

  '03_ui_styles.txt': [
    'src/ui/views/sidebar.js',
    'src/ui/views/chat-view.js',
    'src/ui/renderers/message-renderer.js',
    'src/ui/views/assistant-bar.js',
    'src/ui/views/profile-modal.js',
    'src/ui/views/private-chat.js',
    'src/ui/views/admin-panel.js',
    'src/ui/views/game-view.js',
    'src/ui/views/room-list.js',
    'src/styles/main.css',
    'src/styles/themes.css',
    'src/styles/sidebar.css',
    'src/styles/chat.css',
    'src/styles/modals.css',
    'src/styles/private-chat.css',
    'src/styles/admin.css',
    'src/styles/games.css',
    'src/styles/markdown.css',
    'src/styles/responsive.css'
  ],

  '04_services.txt': [
    'src/services/avatar-service.js',
    'src/services/i18n.js',
    'src/services/api-service.js',
    'src/services/http-client.js',
    'src/services/auth-service.js',
    'src/services/markdown-service.js',
    'src/services/sanitizer.js',
    'src/services/long-polling-client.js',
    'Infocom_API_Reference.txt'
  ],

  '05_models.txt': [
    'src/models/multi-user-manager.js',
    'src/models/session-manager.js',
    'src/models/notification-manager.js',
    'src/models/achievement-manager.js',
    'src/models/rag-manager.js',
    'src/models/workspace-manager.js',
    'src/models/assistant-manager.js',
    'src/models/file-manager.js',
    'src/models/reaction-manager.js',
    'src/models/input-history.js',
    'src/models/rate-limiter.js',
    'src/models/roadmap-tracker.js',
    'src/models/embedding-cache.js'
  ]
};

function buildArchive(outFile, files) {
  const parts = [];
  parts.push(`/* ============================================================ */`);
  parts.push(`/* ARCHIVE: ${outFile} */`);
  parts.push(`/* Generated: ${new Date().toISOString()} */`);
  parts.push(`/* Project: Infocom LM Chat Pro (v6.1 → v6.2) */`);
  parts.push(`/* Files: ${files.length} */`);
  parts.push(`/* ============================================================ */`);

  let found = 0, missing = 0;

  for (const rel of files) {
    const abs = path.resolve(process.cwd(), rel);
    parts.push(`\n// ===== FILE: ${rel} =====`);
    if (!fs.existsSync(abs)) {
      parts.push(`// [ФАЙЛ НЕ НАЙДЕН — пропущен]`);
      console.warn(`⚠  Не найден: ${rel}`);
      missing++;
      continue;
    }
    parts.push(fs.readFileSync(abs, 'utf-8'));
    parts.push(`// ===== END: ${rel} =====`);
    found++;
  }

  fs.writeFileSync(outFile, parts.join('\n'), 'utf-8');
  const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`✅ ${outFile} — ${kb} KB (найдено ${found}, пропущено ${missing})`);
}

console.log('Сборка архива...\n');
for (const [out, files] of Object.entries(GROUPS)) {
  buildArchive(out, files);
}
console.log('\nГотово. Загружайте .txt-файлы в новый чат.');