// src/ui/components/virtual-scroll.js
import { CONFIG } from '../../config.js';

/**
 * Виртуальный скролл для оптимизации отображения большого количества сообщений
 */
export class VirtualScroll {
    constructor(container, itemHeight = CONFIG.VIRTUAL_SCROLL.ITEM_HEIGHT, buffer = CONFIG.VIRTUAL_SCROLL.BUFFER) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.buffer = buffer;
        this.items = [];
        this._visibleItems = new Map();
        this._rendered = new Set();
        this.totalHeight = 0;
        this._spacerTop = null;
        this._spacerBottom = null;
        this._scrollListener = this._onScroll.bind(this);
        this._resizeObserver = null;

        this._initSpacers();
        this.container.addEventListener('scroll', this._scrollListener);
        this._setupResizeObserver();
    }

    _initSpacers() {
        this._spacerTop = document.createElement('div');
        this._spacerTop.style.height = '0px';
        this._spacerTop.style.width = '100%';
        this._spacerTop.style.flexShrink = '0';
        this._spacerBottom = document.createElement('div');
        this._spacerBottom.style.height = '0px';
        this._spacerBottom.style.width = '100%';
        this._spacerBottom.style.flexShrink = '0';
        this.container.prepend(this._spacerTop);
        this.container.append(this._spacerBottom);
    }

    _setupResizeObserver() {
        this._resizeObserver = new ResizeObserver(() => {
            this._renderVisible();
        });
        this._resizeObserver.observe(this.container);
    }

    setItems(items) {
        this.items = items;
        this.totalHeight = items.length * this.itemHeight;
        this._updateSpacers();
        this._clearRendered();
        this._renderVisible();
    }

    _updateSpacers() {
        if (this._spacerTop) {
            this._spacerTop.style.height = '0px';
        }
        if (this._spacerBottom) {
            this._spacerBottom.style.height = `${this.totalHeight}px`;
        }
    }

    _onScroll() {
        this._renderVisible();
    }

    _renderVisible() {
        if (this.items.length === 0) return;

        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(this.items.length, Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.buffer);

        const visible = new Set();
        for (let i = startIndex; i < endIndex; i++) {
            visible.add(i);
            if (!this._rendered.has(i)) {
                this._renderItem(i);
                this._rendered.add(i);
            }
        }

        for (const idx of this._rendered) {
            if (!visible.has(idx)) {
                const el = this._visibleItems.get(idx);
                if (el && el.parentNode) {
                    el.remove();
                }
                this._visibleItems.delete(idx);
                this._rendered.delete(idx);
            }
        }

        for (const idx of visible) {
            const el = this._visibleItems.get(idx);
            if (el) {
                el.style.position = 'absolute';
                el.style.top = `${idx * this.itemHeight}px`;
                el.style.left = '0';
                el.style.width = '100%';
                el.style.height = `${this.itemHeight}px`;
                el.style.padding = '0 20px';
                el.style.boxSizing = 'border-box';
            }
        }
    }

    _renderItem(index) {
        const item = this.items[index];
        if (!item) return;

        const el = document.createElement('div');
        el.className = `message ${item.role}`;
        el.style.position = 'absolute';
        el.style.top = `${index * this.itemHeight}px`;
        el.style.left = '0';
        el.style.width = '100%';
        el.style.height = `${this.itemHeight}px`;
        el.style.padding = '0 20px';
        el.style.boxSizing = 'border-box';
        el.style.overflow = 'hidden';

        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = item.role === 'user' ? '👤 Вы' : '💻 Infocom_LM_Chat';
        el.appendChild(label);

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const content = document.createElement('div');
        content.textContent = item.content;
        bubble.appendChild(content);
        el.appendChild(bubble);

        this.container.appendChild(el);
        this._visibleItems.set(index, el);
    }

    _clearRendered() {
        for (const [idx, el] of this._visibleItems) {
            if (el && el.parentNode) {
                el.remove();
            }
        }
        this._visibleItems.clear();
        this._rendered.clear();
    }

    appendItem(item) {
        this.items.push(item);
        this.totalHeight = this.items.length * this.itemHeight;
        this._updateSpacers();
        this._renderVisible();
        this.scrollToBottom();
    }

    clear() {
        this._clearRendered();
        this.items = [];
        this.totalHeight = 0;
        this._updateSpacers();
    }

    destroy() {
        this.container.removeEventListener('scroll', this._scrollListener);
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        this._clearRendered();
        if (this._spacerTop) this._spacerTop.remove();
        if (this._spacerBottom) this._spacerBottom.remove();
    }

    updateItem(index, content) {
        const el = this._visibleItems.get(index);
        if (el) {
            const bubble = el.querySelector('.bubble');
            if (bubble) {
                const contentDiv = document.createElement('div');
                contentDiv.textContent = content;
                bubble.innerHTML = '';
                bubble.appendChild(contentDiv);
            }
        }
    }

    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    getItem(index) {
        return this.items[index] || null;
    }

    getItems() {
        return this.items;
    }

    getItemCount() {
        return this.items.length;
    }

    setItemHeight(height) {
        this.itemHeight = height;
        this.totalHeight = this.items.length * height;
        this._updateSpacers();
        this._renderVisible();
    }
}