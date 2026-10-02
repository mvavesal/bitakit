/**
 * Deprecated helpers kept until the optional packages are migrated (refactor Phase 5). Each
 * maps onto the current API and warns once in development.
 */
import {
  defineAction,
  defineService,
  type ActionSpec,
  type ActionSpecInput,
  type LegacyServiceDefinition,
  type PluginPageDefinition,
  type PluginView,
  type ServiceDefinition,
  type Services,
  type Setup,
} from './definitions.js';
import type { ServiceKey } from './service-key.js';
import type { PresentationType } from './presentation.js';
import type { ConfigContext } from './config-service.js';
import {
  defineInterceptor,
  type InterceptorSpec,
  type ServiceInterceptorSpec,
} from './interceptors/define.js';
import type { ActionPresentation } from '@bitakit/core/actions';

const warned = new Set<string>();
export function deprecated(name: string, hint: string) {
  if (warned.has(name)) return;
  warned.add(name);
  let development = true;
  try {
    development = process.env.NODE_ENV !== 'production';
  } catch {
    /* no process */
  }
  if (development) console.warn(`[bitakit] ${name} is deprecated. ${hint}`);
}

/** @deprecated Use `defineService(factory, { provides: key })`. */
export function provideService<T, const D extends Omit<LegacyServiceDefinition<NoInfer<T>>, 'id'>>(
  key: ServiceKey<T>,
  definition: D,
): ServiceDefinition<T> & { provides: ServiceKey<T> } & Pick<D, 'exposeAs' & keyof D> {
  deprecated('provideService', 'Use defineService(factory, { provides: key }).');
  const service = defineService(definition as LegacyServiceDefinition<T>);
  return { ...service, provides: key } as ServiceDefinition<T> & { provides: ServiceKey<T> } & Pick<
      D,
      'exposeAs' & keyof D
    >;
}

/** @deprecated Use `defineAction({ title, href, groups })`. */
export function defineURLAction<Input = void>(
  definition: ActionSpecInput<Input, void> & { href: string },
): ActionSpec<Input, void> {
  deprecated('defineURLAction', 'Use defineAction({ title, href, groups }).');
  return defineAction<Input, void>(
    definition as ActionSpecInput<Input, void> & { input?: undefined },
  );
}

type DialogRender<Input> = (props: {
  input: Input;
  close(): void;
  services: Services;
}) => PresentationType<'node'>;
/** @deprecated Use `defineAction({ title, dialog: Component })`. */
export function defineDialogAction<Input = unknown>(
  definition: Omit<ActionSpecInput<Input, void>, 'dialog' | 'execute'> & {
    render: DialogRender<Input>;
    size?: 'default' | 'wide';
    resolve?: (
      input: Input,
      context: { services: Services; config: ConfigContext },
    ) => ActionPresentation;
  },
): ActionSpec<Input, void> {
  deprecated('defineDialogAction', 'Use defineAction({ title, dialog: Component }).');
  const { render, size, ...rest } = definition;
  return defineAction<Input, void>({
    ...(rest as ActionSpecInput<Input, void> & { input?: undefined }),
    dialog: render as unknown as PresentationType<'component'>,
    dialogSize: size,
  });
}

/** @deprecated Export the page component from `ui/pages/<path>.tsx` instead. */
export function definePage(page: PluginPageDefinition): PluginPageDefinition {
  deprecated(
    'definePage',
    'Export the component from ui/pages/<path>.tsx; the path comes from the file name.',
  );
  return page;
}
/** @deprecated Export the component from `ui/slots/<slot>.tsx` instead. */
export function defineView(view: PluginView): PluginView {
  deprecated(
    'defineView',
    'Export the component from ui/slots/<slot>.tsx; the slot comes from the file name.',
  );
  return view;
}
/** @deprecated Export the function from `setup.ts` directly. */
export function defineSetup(setup: Setup): Setup {
  return setup;
}
/** @deprecated Use `defineInterceptor({ service, method, ... })`. */
export function defineServiceInterceptor(
  spec: Omit<ServiceInterceptorSpec<any, any>, 'kind'>,
): InterceptorSpec {
  deprecated(
    'defineServiceInterceptor',
    'Use defineInterceptor({ service, method, before, after, onError }).',
  );
  return defineInterceptor(spec as ServiceInterceptorSpec<any, any>);
}
