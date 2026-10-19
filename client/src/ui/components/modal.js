// src/ui/components/modal.js

/**
 * Базовый класс для управления модальными окнами
 */
export class Modal {
    constructor(element, options = {}) {
        this.element = element;
        this.isOpen = false;
        this.onOpen = options.onOpen || null;
        this.onClose = options.onClose || null;
        this.closeOnOverlayClick = options.closeOnOverlayClick !== undefined ? options.closeOnOverlayClick : true;
        this.closeOnEscape = options.closeOnEscape !== undefined ? options.closeOnEscape : true;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Закрытие по клику на overlay
        if (this.closeOnOverlayClick) {
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.close();
                }
            });
        }

        // Закрытие по Escape
        if (this.closeOnEscape) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }
    }

    open() {
        this.element.classList.add('active');
        this.element.setAttribute('aria-hidden', 'false');
        this.isOpen = true;
        if (this.onOpen) this.onOpen();
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.element.classList.remove('active');
        this.element.setAttribute('aria-hidden', 'true');
        this.isOpen = false;
        if (this.onClose) this.onClose();
        document.body.style.overflow = '';
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    isActive() {
        return this.isOpen;
    }

    setContent(html) {
        const content = this.element.querySelector('.modal-content');
        if (content) {
            content.innerHTML = html;
        }
    }

    getElement() {
        return this.element;
    }
}