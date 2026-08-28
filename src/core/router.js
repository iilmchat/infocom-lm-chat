// src/core/router.js
/**
 * Простой SPA-роутер на основе History API
 * Добавлено в 6.0
 */
export class Router {
    constructor(routes = {}) {
        this.routes = routes;
        this.currentPath = window.location.pathname;
        this.currentParams = {};
        this.beforeHandlers = [];
        this.afterHandlers = [];
        this.notFoundHandler = null;
        this.currentHandler = null;

        // Обработка popstate
        window.addEventListener('popstate', (e) => {
            const path = window.location.pathname;
            this.navigate(path, { replace: true, trigger: true });
        });

        // Перехват кликов по ссылкам с data-link
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                //const href = link.getAttribute('href');
                const href = link.getAttribute('data-link');
                if (href) {
                    this.navigate(href);
                }
            }
        });
    }

    addRoute(path, handler) {
        this.routes[path] = handler;
        return this;
    }

    setNotFound(handler) {
        this.notFoundHandler = handler;
        return this;
    }

    beforeNavigate(callback) {
        this.beforeHandlers.push(callback);
        return this;
    }

    afterNavigate(callback) {
        this.afterHandlers.push(callback);
        return this;
    }

    navigate(path, options = {}) {
        const { replace = false, trigger = true, state = {} } = options;
        let normalizedPath = path.startsWith('/') ? path : '/' + path;
        normalizedPath = normalizedPath.replace(/\/+/g, '/');

        for (const fn of this.beforeHandlers) {
            if (fn(normalizedPath) === false) return;
        }

        if (replace) {
            history.replaceState(state, '', normalizedPath);
        } else {
            history.pushState(state, '', normalizedPath);
        }

        this.currentPath = normalizedPath;
        if (trigger) {
            this.triggerRoute(normalizedPath);
        }

        for (const fn of this.afterHandlers) {
            fn(normalizedPath);
        }
    }

    triggerRoute(path) {
        let matchedRoute = null;
        let params = {};

        for (const route of Object.keys(this.routes)) {
            const routeParts = route.split('/');
            const pathParts = path.split('/');
            if (routeParts.length !== pathParts.length) continue;

            let match = true;
            const tempParams = {};
            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(':')) {
                    const paramName = routeParts[i].slice(1);
                    tempParams[paramName] = pathParts[i];
                } else if (routeParts[i] !== pathParts[i]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                matchedRoute = route;
                params = tempParams;
                break;
            }
        }

        this.currentParams = params;

        if (matchedRoute) {
            const handler = this.routes[matchedRoute];
            if (typeof handler === 'function') {
                handler(params);
            } else if (handler && typeof handler.enter === 'function') {
                if (this.currentHandler && this.currentHandler.exit) {
                    this.currentHandler.exit();
                }
                handler.enter(params);
                this.currentHandler = handler;
            }
        } else if (this.notFoundHandler) {
            this.notFoundHandler(path);
        } else {
            console.warn(`Маршрут не найден: ${path}`);
        }
    }

    getPath() {
        return this.currentPath;
    }

    getParams() {
        return this.currentParams;
    }
}