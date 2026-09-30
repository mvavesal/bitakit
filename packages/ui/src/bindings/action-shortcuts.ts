import {
  assertValidHotkey,
  getHotkeyManager,
  type Hotkey,
  type HotkeyRegistrationHandle,
} from '@tanstack/hotkeys';
import type { ActionList, ActionShortcut } from '@bitakit/core';

export type ActionShortcutOptions = {
  /** Only these scopes are active; unscoped Actions belong to `global`. */
  scopes?: readonly string[];
  /** Restrict keyboard handling to a mounted application surface. */
  target?: HTMLElement | Document;
};

/** One library binding per registered Action, independent of any rendered controls. */
export function bindActionShortcuts(
  list: ActionList,
  options: ActionShortcutOptions,
  onError: (error: unknown) => void,
) {
  const manager = getHotkeyManager();
  const bindings = new Map<
    string,
    { shortcut: ActionShortcut; handle: HotkeyRegistrationHandle }
  >();
  const rejected = new Map<string, ActionShortcut>();
  const report = (error: unknown) => {
    try {
      onError(error);
    } catch {
      /* diagnostics only */
    }
  };
  const active = (shortcut: ActionShortcut) =>
    (options.scopes ?? ['global']).includes(shortcut.scope ?? 'global');
  const sync = () => {
    const actions = list.getState().actions;
    for (const [id, binding] of bindings) {
      const action = actions[id];
      if (
        !action ||
        action.internal ||
        action.shortcut !== binding.shortcut ||
        !active(binding.shortcut)
      ) {
        binding.handle.unregister();
        bindings.delete(id);
        rejected.clear();
      }
    }
    for (const action of Object.values(actions)) {
      const shortcut = action.shortcut;
      if (!shortcut || action.internal || !active(shortcut)) continue;
      const resolved = list.resolve(action.id, shortcut.input);
      const enabled =
        !!resolved?.visible && !!resolved.enabled && !resolved.pending && !!resolved.execute;
      const existing = bindings.get(action.id);
      if (existing) {
        existing.handle.setOptions({ enabled });
        continue;
      }
      if (rejected.get(action.id) === shortcut) continue;
      try {
        assertValidHotkey(shortcut.keys);
        const handle = manager.register(
          shortcut.keys as Hotkey,
          (event) => {
            if (event.defaultPrevented || event.repeat || event.isComposing) return;
            const current = list.resolve(action.id, shortcut.input);
            if (!current?.visible || !current.enabled || current.pending || !current.execute)
              return;
            event.preventDefault();
            void list.execute(action.id, shortcut.input).catch(report);
          },
          {
            enabled,
            target: options.target ?? document,
            ignoreInputs: !shortcut.allowInInputs,
            preventDefault: false,
            stopPropagation: false,
            conflictBehavior: 'error',
            meta: { name: action.title },
          },
        );
        bindings.set(action.id, { shortcut, handle });
        rejected.delete(action.id);
      } catch (error) {
        rejected.set(action.id, shortcut);
        report(error);
      }
    }
  };
  const unsubscribe = list.subscribe(sync);
  sync();
  return () => {
    unsubscribe();
    bindings.forEach(({ handle }) => handle.unregister());
    bindings.clear();
  };
}
