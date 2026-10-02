import { Action } from './action.js';
import { NavigationHost } from './navigation.js';
import { isBrandedInstance } from './brand.js';
import type { ActionPatch, ActionRegistration } from './types.js';

type Entry = {
  action: Action<any, any>;
  unsubscribe: () => void;
  disconnect?: () => void;
};

/** Owns subscriptions to class instances and external services. */
export class InstanceBindings {
  private entries = new Map<string, Entry>();
  private mounted = false;
  private synchronizing = false;
  private navigate?: (href: string) => void;
  constructor(private environment: unknown) {}

  attach(id: string, action: Action<any, any>, registration: ActionRegistration) {
    {
      const host = this.environment;
      if (isBrandedInstance(host, NavigationHost, 'navigation'))
        action.bindNavigation((href) => host.go(href));
    }
    const entry: Entry = {
      action,
      unsubscribe: action.subscribe(() => {
        if (!this.synchronizing) registration.update(action.snapshot());
      }),
    };
    this.entries.set(id, entry);
    try {
      if (this.mounted) this.connect(entry);
    } catch (error) {
      entry.unsubscribe();
      this.entries.delete(id);
      registration.unregister();
      throw error;
    }
    return () => {
      if (this.entries.get(id) !== entry) return;
      entry.disconnect?.();
      entry.unsubscribe();
      this.entries.delete(id);
      registration.unregister();
    };
  }

  apply(id: string, patch: ActionPatch) {
    const entry = this.entries.get(id);
    if (!entry || this.synchronizing) return;
    this.synchronizing = true;
    try {
      Object.assign(entry.action, patch);
    } finally {
      this.synchronizing = false;
    }
  }

  private connect(entry: Entry) {
    if (this.navigate) entry.action.bindNavigation(this.navigate);
    entry.disconnect = entry.action.connect() || undefined;
  }

  mount(navigate?: (href: string) => void) {
    this.mounted = true;
    this.navigate = navigate;
    const unbind =
      isBrandedInstance(this.environment, NavigationHost, 'navigation') && navigate
        ? this.environment.bind(navigate)
        : undefined;
    const cleanup = () => {
      this.mounted = false;
      unbind?.();
      this.entries.forEach((entry) => {
        entry.disconnect?.();
        entry.disconnect = undefined;
      });
    };
    try {
      this.entries.forEach((entry) => this.connect(entry));
    } catch (error) {
      cleanup();
      throw error;
    }
    return cleanup;
  }

  dispose() {
    this.entries.forEach((entry) => {
      entry.disconnect?.();
      entry.unsubscribe();
    });
    this.entries.clear();
  }
}
