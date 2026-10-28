'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { definePlugin } from '@bitakit/core';
import { useBitaKit, useServiceState } from '@bitakit/ui';
import { liveAction, type LiveConfig } from '../../live-action';

/**
 * Keeps one Action in the app for every live configuration. Actions usually come from files;
 * these are made while the app runs: the host runtime adds a small plugin with the Action from
 * live-action.ts, replaces it after an edit and removes it with its configuration.
 */
export default function LiveActions({ children }: { children: ReactNode }) {
  const { runtime } = useBitaKit();
  const configs = useServiceState('playground.live', (state) => state.configs, []);
  const added = useRef(new Map<string, LiveConfig>());
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    // One change at a time, in order: an edit replaces the plugin of its Action.
    queue.current = queue.current.then(async () => {
      const wanted = new Map(configs.map((config) => [`live-${config.number}`, config]));
      for (const [id, config] of added.current)
        if (wanted.get(id) !== config) {
          await runtime.plugins.remove([id], { dependents: 'refuse' });
          added.current.delete(id);
        }
      for (const [id, config] of wanted)
        if (!added.current.has(id)) {
          await runtime.plugins.add([
            definePlugin({ id, actions: { action: liveAction(config) } }),
          ]);
          added.current.set(id, config);
        }
    });
  }, [configs, runtime]);
  return children;
}
