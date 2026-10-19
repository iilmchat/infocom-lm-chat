// src/models/roadmap-tracker.js

/**
 * Управление дорожной картой проекта
 */
export class RoadmapTracker {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.milestones = [
            { id: 'security', title: '🔒 Безопасность', tasks: [{ id: 's1', text: 'XSS-защита', done: true }, { id: 's2', text: 'Санитизация ввода', done: true }] },
            { id: 'architecture', title: '🏗️ Архитектура', tasks: [{ id: 'a1', text: 'EventBus', done: true }, { id: 'a2', text: 'ES модули', done: true }] },
            { id: 'assistants', title: '🤖 Ассистенты', tasks: [{ id: 'as1', text: '7 встроенных', done: true }, { id: 'as2', text: 'Кастомные', done: true }, { id: 'as3', text: 'UI бар', done: true }] },
            { id: 'multi-user', title: '👥 Multi-user', tasks: [{ id: 'm1', text: 'Индикаторы', done: true }, { id: 'm2', text: 'Share ссылка', done: true }, { id: 'm3', text: 'QR-код', done: true }, { id: 'm4', text: 'Real-time', done: false }] },
            { id: 'tests', title: '🧪 Тестирование', tasks: [{ id: 't1', text: 'Unit-тесты RAG', done: true }, { id: 't2', text: 'Unit-тесты Session', done: true }, { id: 't3', text: 'E2E тесты', done: false }] },
            { id: 'perf', title: '⚡ Производительность', tasks: [{ id: 'p1', text: 'Вирт.скроллинг', done: false }, { id: 'p2', text: 'Web Workers', done: false }, { id: 'p3', text: 'PWA', done: false }] }
        ];
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('roadmap_progress_v41');
            if (saved) {
                const progress = JSON.parse(saved);
                this.milestones.forEach(m => {
                    const sm = progress.find(p => p.id === m.id);
                    if (sm) {
                        m.tasks.forEach(t => {
                            const st = sm.tasks?.find(st => st.id === t.id);
                            if (st) t.done = st.done;
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('Ошибка загрузки прогресса roadmap:', e);
        }
    }

    save() {
        try {
            localStorage.setItem('roadmap_progress_v41', JSON.stringify(this.milestones));
        } catch (e) {
            console.warn('Ошибка сохранения прогресса roadmap:', e);
        }
    }

    toggleTask(mid, tid) {
        const m = this.milestones.find(m => m.id === mid);
        if (!m) return;
        const t = m.tasks.find(t => t.id === tid);
        if (t) {
            t.done = !t.done;
            this.save();
            this.render();
            if (this.eventBus) {
                this.eventBus.emit('roadmap:updated');
            }
        }
    }

    getProgress() {
        const total = this.milestones.reduce((s, m) => s + m.tasks.length, 0);
        const done = this.milestones.reduce((s, m) => s + m.tasks.filter(t => t.done).length, 0);
        return { total, done, percent: Math.round((done / total) * 100) };
    }

    toggleExpand(id) {
        const el = document.querySelector(`.milestone[data-id="${id}"]`);
        if (el) el.classList.toggle('expanded');
    }

    render() {
        const container = document.getElementById('milestoneList');
        if (!container) return;

        const p = this.getProgress();
        container.innerHTML = `
            <div class="overall-progress">
                <div class="progress-label">Общий: ${p.done}/${p.total} (${p.percent}%)</div>
                <div class="progress-bar-small">
                    <div class="progress-fill" style="width:${p.percent}%"></div>
                </div>
            </div>
            ${this.milestones.map(m => `
                <div class="milestone" data-id="${m.id}">
                    <div class="milestone-header" onclick="window.roadmapTracker?.toggleExpand('${m.id}')">
                        <span>${m.title}</span>
                        <span class="milestone-progress">${m.tasks.filter(t => t.done).length}/${m.tasks.length}</span>
                    </div>
                    <div class="milestone-tasks">
                        ${m.tasks.map(t => `
                            <label class="task-item" onclick="window.roadmapTracker?.toggleTask('${m.id}','${t.id}')">
                                <input type="checkbox" ${t.done ? 'checked' : ''} style="pointer-events:none;">
                                <span class="${t.done ? 'done' : ''}">${t.text}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }
}