import { defineAction } from '@bitakit/core';

/**
 * Sample item `n` (1 to 3): placed in the sidebar and in the live card's playground.samples
 * slot, visible once that many items were added. Not an Action file itself (`-` prefix).
 */
export function sample(n: number) {
  return defineAction({
    title: `Sample item ${n}`,
    visible: ({ services }) => services.playground.live.state.get().samples >= n,
    slots: [{ slot: 'shell.navigation', order: -5 + n }, 'playground.samples'],
    execute: () => undefined,
    success: `Sample item ${n} ran`,
  });
}
