// src/ui/views/assistant-bar.js
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Рендеринг панели ассистентов
 */
export function renderAssistantBar(app) {
    const bar = document.getElementById('assistantBar');
    if (!bar) return;

    const all = app.assistantManager.getAll();
    const activeId = app.assistantManager.activeAssistant?.id;

    bar.innerHTML = all.map(a => `
        <div class="assistant-card ${a.id === activeId ? 'active' : ''} ${a.custom ? 'custom' : ''}"
             data-assistant-id="${a.id}" style="${a.id === activeId ? 'border-color:' + a.color + ';' : ''}">
            <span class="assistant-icon">${a.icon}</span>
            <div class="assistant-info">
                <div class="assistant-name">${sanitizeHTML(a.name)}</div>
                <div class="assistant-desc">${sanitizeHTML(a.description)}</div>
            </div>
            <button class="prompt-view-btn" onclick="event.stopPropagation();window.viewPrompt('${a.id}')" title="Просмотр">📋</button>
            ${a.custom ? `<button class="delete-assistant-btn" onclick="event.stopPropagation();window.deleteAssistant('${a.id}')" title="Удалить">✕</button>` : ''}
        </div>
    `).join('') + `
        <div class="add-assistant-btn" onclick="window.openCustomAssistantModal()">
            <span>➕</span> Создать
        </div>
    `;

    bar.querySelectorAll('.assistant-card').forEach(card => {
        card.onclick = () => {
            const id = card.dataset.assistantId;
            if (app.assistantManager.activeAssistant?.id === id) {
                app.assistantManager.deactivate();
            } else {
                app.assistantManager.activate(id);
            }
            renderAssistantBar(app);
            updateActiveIndicator(app);
        };
    });
}

export function updateActiveIndicator(app) {
    const ind = document.getElementById('activeAssistantIndicator');
    const a = app.assistantManager.activeAssistant;
    
    if (a) {
        ind.classList.add('visible');
        document.getElementById('activeAssistantIcon').textContent = a.icon;
        document.getElementById('activeAssistantName').textContent = a.name;
    } else {
        ind.classList.remove('visible');
    }
}

export function viewPrompt(id) {
    const app = window.app;
    if (!app) return;
    const a = app.assistantManager.get(id);
    if (!a) return;
    
    document.getElementById('promptContent').textContent = a.systemPrompt;
    document.getElementById('promptModal').classList.add('active');
    document.getElementById('copyPromptBtn').onclick = () => {
        navigator.clipboard.writeText(a.systemPrompt).then(() => {
            app.toast.success('Промт скопирован!');
        });
    };
}

export function deleteAssistant(id) {
    const app = window.app;
    if (!app) return;
    
    if (confirm('Удалить этого ассистента?')) {
        app.assistantManager.removeCustom(id);
        renderAssistantBar(app);
        updateActiveIndicator(app);
        app.toast.info('Ассистент удален');
    }
}

export function openCustomAssistantModal() {
    document.getElementById('customAssistantModal').classList.add('active');
    document.getElementById('caName').value = '';
    document.getElementById('caIcon').value = '🤖';
    document.getElementById('caDesc').value = '';
    document.getElementById('caPrompt').value = '';
    document.querySelectorAll('.color-preset').forEach(el => el.classList.remove('selected'));
    document.querySelector('.color-preset')?.classList.add('selected');
}

// Глобальные функции для вызова из HTML
window.viewPrompt = viewPrompt;
window.deleteAssistant = deleteAssistant;
window.openCustomAssistantModal = openCustomAssistantModal;