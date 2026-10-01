'use client';
import { useEffect, useState, type ReactNode, type ComponentType } from 'react';
import { createActionList, type ActionList } from '@bitakit/core';
import type { ActionInterceptor } from '@bitakit/core';
import { ActionContext, UIContext } from './action-context.js';
import { bindActionShortcuts, type ActionShortcutOptions } from '../bindings/action-shortcuts.js';
const defaultShortcuts = {};
const noInterceptors: readonly ActionInterceptor[] = [];
// Browser fallback belongs to the UI boundary; integrations supply their own router.
const browserNavigate = (href: string) => window.location.assign(href);
export type ActionProviderProps = {
  children: ReactNode;
  actions?: ActionList;
  list?: ActionList;
  navigate?: (href: string) => void;
  Link?: ComponentType<any>;
  pathname?: string;
  onError?: (error: unknown) => void;
  interceptors?: readonly ActionInterceptor[];
  shortcuts?: false | ActionShortcutOptions;
};
export function ActionProvider({
  children,
  actions,
  list,
  navigate = browserNavigate,
  Link,
  pathname,
  onError = console.error,
  interceptors = noInterceptors,
  shortcuts = defaultShortcuts,
}: ActionProviderProps) {
  const [owned] = useState(() => actions ?? list ?? createActionList());
  const current = actions ?? list ?? owned;
  useEffect(() => {
    const cleanups = interceptors.map((interceptor) => current.use(interceptor));
    return () => cleanups.reverse().forEach((cleanup) => cleanup());
  }, [current, interceptors]);
  useEffect(() => current.mount(navigate), [current, navigate]);
  useEffect(
    () => (shortcuts === false ? undefined : bindActionShortcuts(current, shortcuts, onError)),
    [current, shortcuts, onError],
  );
  return (
    <ActionContext.Provider value={current}>
      <UIContext.Provider value={{ onError, Link, pathname, navigate }}>{children}</UIContext.Provider>
    </ActionContext.Provider>
  );
}
