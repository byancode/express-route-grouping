import { Router } from 'express';
import pluralize from 'pluralize';
import RESOURCES from './resources';
class RouteGroup {
    head;
    router;
    proxyRouter;
    constructor(path = '/', router = Router()) {
        this.head = path;
        this.router = router;
    }
    group = (path = '', fn) => {
        const newGroup = new RouteGroup(this.head + this.sanitize(path), this.router);
        this.proxyRouter = this.createProxy(this.router, newGroup);
        fn(this.proxyRouter);
    };
    resource = (options) => {
        if (!options) {
            throw new Error('Resource handlers are required!');
        }
        const { handlers = {}, beforeHandlers = [], afterHandlers = [] } = options;
        Object.keys(RESOURCES).forEach((name) => {
            const { method, suffix } = RESOURCES[name];
            const requestRouter = this.router[method];
            const fullPath = this.to(suffix ? this.getPlaceholder() : '/');
            const handler = handlers[name];
            if (handler) {
                requestRouter.bind(this.router)(fullPath, ...beforeHandlers, ...(Array.isArray(handler) ? handler : [handler]), ...afterHandlers);
            }
        });
    };
    export = () => this.router;
    to = (suffix = '/') => {
        return this.head + this.sanitize(suffix);
    };
    sanitize(path) {
        if (path === '/')
            return '';
        // remove slashes at start and end positions, if exists
        // to sure there is no any slashes.
        let newPath = path.replace(/^(\/+)(.)/, '$2').replace(/(.)(\/+)$/, '$1');
        // add delimiter on the end
        if (this.head !== '/') {
            newPath = newPath.padStart(newPath.length + 1, '/');
        }
        return newPath;
    }
    callRouter(value) {
        return typeof value === 'function'
            ? (path, ...handlers) => {
                value.call(this.router, this.to(path), ...handlers);
            }
            : this.router[value];
    }
    getPlaceholder() {
        const namespace = this.head.split('/').pop() || '';
        const prefix = pluralize.singular(namespace);
        return `:${prefix ? `${prefix}Id` : 'id'}`;
    }
    createProxy(router, newGroup) {
        const self = newGroup;
        const callRouter = this.callRouter.bind(newGroup);
        const handler = {
            get: function (_, prop) {
                return self[prop]
                    ? Reflect.get(self, prop)
                    : callRouter(router[prop]);
            },
        };
        return new Proxy(this, handler);
    }
}
export default RouteGroup;
