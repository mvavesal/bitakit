'use client';
import { useCallback, useSyncExternalStore } from 'react';
import type {
  SaveResult,
  SettingKey,
  SettingSpec,
  SettingState,
  SettingValue,
} from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';

export type UseSettingResult<T> = SettingState<T> & {
  key: string;
  definition: SettingSpec<T>;
  /** Not loaded yet, read-only, or saving. */
  disabled: boolean;
  set(value: T): Promise<SaveResult>;
  reset(): Promise<SaveResult>;
};
/**
 * One setting by key (`'todos.pageSize'`, app settings by plain name). Reads the confirmed
 * value from the runtime store and writes through it; there is no second value store.
 */
export function useSetting<Key extends SettingKey>(key: Key): UseSettingResult<SettingValue<Key>> {
  const { runtime } = useFoundation();
  const store = runtime.settings;
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => store.state<SettingValue<Key>>(key),
    () => store.initialState<SettingValue<Key>>(key),
  );
  const set = useCallback((value: SettingValue<Key>) => store.set(key, value), [store, key]);
  const reset = useCallback(() => store.reset(key), [store, key]);
  return {
    ...state,
    key,
    definition: store.definition(key).spec as SettingSpec<SettingValue<Key>>,
    disabled: !state.ready || !state.writable || state.pending,
    set,
    reset,
  };
}
