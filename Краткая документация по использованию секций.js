// Использование в коде

// Переключить секцию по ID
toggleSection('statsPanel');

// Или через SectionHelpers
import { SectionHelpers } from './utils/section-helpers.js';
SectionHelpers.toggleSection('statsPanel');

// Развернуть секцию
SectionHelpers.expandSection('statsPanel');

// Свернуть секцию
SectionHelpers.collapseSection('statsPanel');

// Проверить состояние
const isExpanded = SectionHelpers.isSectionExpanded('statsPanel');

// Развернуть все секции
SectionHelpers.expandAllSections();

// Свернуть все секции
SectionHelpers.collapseAllSections();