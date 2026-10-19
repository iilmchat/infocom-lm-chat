// src/ui/views/assistant-bar.js
/**
 * Панель ассистентов в шапке чата
 * Изменено в 6.1: кнопки теперь используют классы btn
 */
import { sanitizeHTML } from '../../services/sanitizer.js';

/**
 * Рендеринг панели ассистентов
 */
export function renderAssistantBar(app) {
    const container = document.getElementById('assistantBar');
    if (!container) return;

    const assistants = app.assistantManager.getAll();
    const activeId = app.assistantManager.activeAssistant?.id;
    const active = app.assistantManager.activeAssistant;    

    let html = '';
    assistants.forEach(a => {
        const isActive = active && active.id === a.id;
        html += `
            <div class="assistant-card ${isActive ? 'active' : ''} ${a.custom ? 'custom' : ''}" data-id="${a.id}">
                <span class="assistant-icon">${a.icon || '🤖'}</span>
                <div class="assistant-info">
                    <span class="assistant-name">${sanitizeHTML(a.name)}</span>
                    <span class="assistant-desc">${sanitizeHTML(a.description || '')}</span>
                </div>
                <button class="prompt-view-btn btn btn-secondary btn-sm" data-id="${a.id}" title="Посмотреть промт">📋</button>
                ${a.custom ? `<button class="delete-assistant-btn btn btn-danger btn-sm" data-id="${a.id}" title="Удалить">✕</button>` : ''}
            </div>
        `;
    });

    html += `
        <button class="add-assistant-btn btn btn-secondary btn-sm" id="addAssistantBtn">➕ Добавить</button>
    `;

    container.innerHTML = html;

    // Обработчики
    container.querySelectorAll('.assistant-card').forEach(card => {
        const id = card.dataset.id;
        card.addEventListener('click', (e) => {
            if (e.target.closest('.prompt-view-btn') || e.target.closest('.delete-assistant-btn')) return;
            app.assistantManager.activate(id);
            renderAssistantBar(app);
            app.updateActiveIndicator();
            app.toast.success(`Ассистент: ${app.assistantManager.activeAssistant.name}`);
        });
    });

    container.querySelectorAll('.prompt-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            viewPrompt(app, id);
        });
    });

    container.querySelectorAll('.delete-assistant-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            if (confirm('Удалить этого ассистента?')) {
                deleteAssistant(app, id);
                renderAssistantBar(app);
            }
        });
    });

    document.getElementById('addAssistantBtn').addEventListener('click', () => {
        openCustomAssistantModal(app);
    });
}

export function updateActiveIndicator(app) {
    const container = document.getElementById('activeAssistantIndicator');
    if (!container) return;
    const active = app.assistantManager.activeAssistant;
    
    if (active) {
        container.classList.add('visible');
        document.getElementById('activeAssistantIcon').textContent = active.icon || '🤖';
        document.getElementById('activeAssistantName').textContent = active.name;
    } else {
        container.classList.remove('visible');
    }
}

export function viewPrompt(app, id) {
    const assistant = app.assistantManager.get(id);
    if (!assistant) return;
    const modal = document.getElementById('promptModal');
    document.getElementById('promptContent').textContent = assistant.systemPrompt || 'Промт не задан';
    modal.classList.add('active');
}

export function deleteAssistant(app, id) {
    //const app = window.app;
    if (!app) return;
    
    if (confirm('Удалить этого ассистента?')) {
        app.assistantManager.removeCustom(id);
        renderAssistantBar(app);
        updateActiveIndicator(app);
        app.toast.info('Ассистент удалён');
    }
}

export function openCustomAssistantModal(app) {
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