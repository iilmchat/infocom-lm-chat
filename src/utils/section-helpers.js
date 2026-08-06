// src/utils/section-helpers.js
import sectionToggle from '../ui/components/section-toggle.js';

/**
 * Утилиты для работы с секциями
 */
export const SectionHelpers = {
    /**
     * Переключает секцию по ID
     * @param {string} id - ID секции
     */
    toggleSection(id) {
        sectionToggle.toggle(id);
    },

    /**
     * Разворачивает секцию по ID
     * @param {string} id - ID секции
     */
    expandSection(id) {
        sectionToggle.setState(id, true);
    },

    /**
     * Сворачивает секцию по ID
     * @param {string} id - ID секции
     */
    collapseSection(id) {
        sectionToggle.setState(id, false);
    },

    /**
     * Проверяет, развернута ли секция
     * @param {string} id - ID секции
     * @returns {boolean}
     */
    isSectionExpanded(id) {
        return sectionToggle.getState(id);
    },

    /**
     * Разворачивает все секции
     */
    expandAllSections() {
        sectionToggle.expandAll();
    },

    /**
     * Сворачивает все секции
     */
    collapseAllSections() {
        sectionToggle.collapseAll();
    },

    /**
     * Получает состояние всех секций
     * @returns {Object}
     */
    getAllSectionStates() {
        return sectionToggle.getAllStates();
    }
};

// Глобальная функция для использования в onclick
window.toggleSection = SectionHelpers.toggleSection;