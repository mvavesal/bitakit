import { defineService } from '@bitakit/core';

/** Deliberately local: resets when the plugin is removed or the page reloads. */
export default defineService({
  id: 'demoPreferences',
  create() {
    let enabled = true;
    const listeners = new Set<() => void>();
    return {
      get enabled() {
        return enabled;
      },
      setEnabled(value: boolean) {
        if (enabled === value) return;
        enabled = value;
        listeners.forEach((listener) => listener());
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  },
});
