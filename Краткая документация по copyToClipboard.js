// Использование в любом месте проекта
import { copyToClipboard } from './utils/dom-helpers.js';

// Простое копирование
copyToClipboard('Текст для копирования');

// С колбэками
copyToClipboard(
    'Текст для копирования',
    () => {
        console.log('Успешно скопировано!');
        // Показать уведомление
    },
    (error) => {
        console.error('Ошибка копирования:', error);
        // Показать сообщение об ошибке
    }
);

// Копирование кода
const code = 'console.log("Hello World!")';
copyToClipboard(code, () => {
    // Показать уведомление об успешном копировании
    toast.success('Код скопирован!');
});