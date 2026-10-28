import { defineAction, type Services } from '@bitakit/core';
import type { Place } from '../services/live';
import { liveIcon } from '../ui/live-icon';

/**
 * Live Action `n` (0 to 3), shared by actions/live/first.ts to fourth.ts. Every field reads
 * entry `n` of the playground.live service, so an edit there shows wherever the Action is.
 * Each placement passes its place as input: the Action shows there when its entry lists the
 * place, and in the example's card (no input) as soon as it was added.
 */
export function live(n: number) {
  const entry = (services: Services) => services.playground.live.state.get().actions[n];
  return defineAction<Place | undefined>({
    title: ({ services }) => entry(services)?.title || `Action ${n + 1}`,
    tooltip: ({ services }) => entry(services)?.tooltip || undefined,
    enabled: ({ services }) => entry(services)?.enabled ?? false,
    visible: ({ input, services }) => {
      const action = entry(services);
      return action !== undefined && (input === undefined || action.places.includes(input));
    },
    icon: liveIcon(n),
    slots: [
      { slot: 'shell.toolbar', input: () => 'toolbar' },
      { slot: 'shell.navigation', order: -5 + n, input: () => 'navigation' },
    ],
    execute: () => undefined,
    success: ({ services }) => `${entry(services)?.title || `Action ${n + 1}`} ran`,
  });
}
