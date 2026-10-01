import type { ActionRegistration, ActionPresentation } from '../actions/types.js';
import type { FoundationApp } from '../app/types.js';
import type { ConfigContext } from '../config-service.js';
import type { Services } from '../definitions.js';
import type { Events } from './types.js';

/** Presentation writes use the existing ActionList store and registration identity guards. */
export type SetupAction = ActionPresentation & {
  get: ActionRegistration['get'];
  update: ActionRegistration['update'];
};
export type ActionSetupContext = {
  events: Events;
  services: Services;
  action: SetupAction;
  app: FoundationApp;
  config: ConfigContext;
};
export type ActionSetup = (context: ActionSetupContext) => void | (() => void);

export function setupAction(handle: ActionRegistration): SetupAction {
  const action: SetupAction = { get: handle.get, update: handle.update };
  const keys = [
    'enabled',
    'visible',
    'checked',
    'title',
    'description',
    'tooltip',
    'icon',
    'href',
    'value',
    'variant',
  ] as const;
  for (const key of keys)
    Object.defineProperty(action, key, {
      enumerable: true,
      get: () => handle.get()?.[key],
      set: (value) => {
        handle.update({ [key]: value });
      },
    });
  return Object.freeze(action);
}
