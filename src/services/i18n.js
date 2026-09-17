// src/services/i18n.js
/* Добавлено в 6.1: модуль интернационализации */
/* Изменено в 6.2: убран import assertion (assert { type: 'json' }),
   локали переведены в ES-модули (ru.js, en.js) */

import ru from '../../locales/ru.js';
import en from '../../locales/en.js';

const LANG_KEY = 'app_language';
const DEFAULT_LANG = 'ru';

class I18n {
    constructor() {
        this.locales = { ru, en };
        this.currentLang = localStorage.getItem(LANG_KEY)
            || (navigator.language ? navigator.language.split('-')[0] : DEFAULT_LANG)
            || DEFAULT_LANG;
        if (!this.locales[this.currentLang]) this.currentLang = DEFAULT_LANG;
        document.documentElement.lang = this.currentLang;
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.locales[this.currentLang];
        for (const k of keys) {
            if (value && value[k] !== undefined) {
                value = value[k];
            } else {
                console.warn(`Translation key "${key}" not found`);
                return key;
            }
        }
        if (typeof value === 'string') {
            for (const [param, val] of Object.entries(params)) {
                value = value.replace(`{{${param}}}`, val);
            }
        }
        return value;
    }

    setLanguage(lang) {
        if (this.locales[lang]) {
            this.currentLang = lang;
            localStorage.setItem(LANG_KEY, lang);
            document.documentElement.lang = lang;
            this.emit('languageChanged', lang);
            return true;
        }
        return false;
    }

    getLanguage() {
        return this.currentLang;
    }

    emit(event, data) {
        document.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
}

export const i18n = new I18n();