import { IRouter as IExpressRouter, Router } from 'express';
import pluralize from 'pluralize';
import { RequestMethods, ResourceOptions, Resources } from './types';
import RESOURCES from './resources';

export type GroupCallback = (router: IRouter) => void;

export type IRouter = IExpressRouter & {
  group: (path: string, fn: GroupCallback) => void;
  resource: (options: ResourceOptions) => void;
  export: () => IExpressRouter;
};

class RouteGroup {
  private head: string;
  private router: IExpressRouter;
  private proxyRouter?: IRouter;

  constructor(path: string = '/', router: IExpressRouter = Router()) {
    this.head = path;
    this.router = router;
  }

  public group = (path: string = '', fn: GroupCallback): void => {
    const newGroup = new RouteGroup(
      this.head + this.sanitize(path),
      this.router
    );
    this.proxyRouter = this.createProxy(this.router, newGroup);
    fn(this.proxyRouter);
  };

  public resource = (options: ResourceOptions) => {
    if (!options) {
      throw new Error('Resource handlers are required!');
    }

    const { handlers = {}, beforeHandlers = [], afterHandlers = [] } = options;

    Object.keys(RESOURCES).forEach((name: string) => {
      const { method, suffix } = RESOURCES[name];
      const requestRouter = this.router[method as RequestMethods];

      const fullPath = this.to(suffix ? this.getPlaceholder() : '/');
      const handler = handlers[name as Resources] as any;

      if (handler) {
        requestRouter.bind(this.router)(
          fullPath,
          ...beforeHandlers,
          ...(Array.isArray(handler) ? handler : [handler]),
          ...afterHandlers
        );
      }
    });
  };

  public export = () => this.router;

  public to = (suffix: string = '/'): string => {
    return this.head + this.sanitize(suffix);
  };

  private sanitize(path: string): string {
    if (path === '/') return '';

    // remove slashes at start and end positions, if exists
    // to sure there is no any slashes.
    let newPath = path.replace(/^(\/+)(.)/, '$2').replace(/(.)(\/+)$/, '$1');

    // add delimiter on the end
    if (this.head !== '/') {
      newPath = newPath.padStart(newPath.length + 1, '/');
    }

    return newPath;
  }

  private callRouter(value: Function | RequestMethods) {
    return typeof value === 'function'
      ? (path: string, ...handlers: CallableFunction[]) => {
          value.call(this.router, this.to(path), ...handlers);
        }
      : this.router[value];
  }

  private getPlaceholder() {
    const namespace = this.head.split('/').pop() || '';
    const prefix = pluralize.singular(namespace);
    return `:${prefix ? `${prefix}Id` : 'id'}`;
  }

  private createProxy(router: IExpressRouter, newGroup: RouteGroup) {
    const self = newGroup as any;
    const callRouter = this.callRouter.bind(newGroup);
    const handler = {
      get: function(_: any, prop: any) {
        return self[prop]
          ? Reflect.get(self, prop)
          : callRouter(router[prop as RequestMethods]);
      },
    };

    return new Proxy<IRouter>(this as any, handler);
  }
}

export default RouteGroup;
