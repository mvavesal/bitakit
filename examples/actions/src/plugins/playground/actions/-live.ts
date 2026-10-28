import { defineAction, type Services } from '@bitakit/core';
import type { Place } from '../services/live';
import { liveIcon } from '../ui/live-icon';
import { wait } from './-wait';

/**
 * Live Action `n` (0 to 3), shared by actions/live/first.ts to fourth.ts. Every field is a
 * function of entry `n` in the playground.live service, so an edit there shows wherever the
 * Action is, at once. Nothing else in the example touches this Action.
 */
export function live(n: number) {
  const entry = (services: Services) => services.playground.live.state.get().actions[n];
  const title = (services: Services) => entry(services)?.title || `Action ${n + 1}`;
  return defineAction<Place | undefined>({
    title: ({ services }) => title(services),
    tooltip: ({ services }) => entry(services)?.tooltip || undefined,
    icon: liveIcon(n),
    enabled: ({ services }) => entry(services)?.enabled ?? false,

    // Placement: each slot passes its place as the input. A visible Action shows in a place when
    // its entry lists it, and without an input (the example's card) everywhere it exists.
    slots: [
      { slot: 'shell.toolbar', input: () => 'toolbar' },
      { slot: 'shell.navigation', order: -5 + n, input: () => 'navigation' },
    ],
    visible: ({ input, services }) => {
      const action = entry(services);
      if (!action?.visible) return false;
      return input === undefined || action.places.includes(input);
    },

    // Running it: the same guards apply to a click, a menu and this shortcut.
    shortcut: { keys: `Alt+${n + 1}` },
    confirm: ({ services }) =>
      entry(services)?.confirm
        ? { title: `Run ${title(services)}?`, description: 'This Action asks first.' }
        : false,
    execute: ({ services, signal }) => (entry(services)?.slow ? wait(1000, signal) : undefined),
    success: ({ services }) => entry(services)?.message || `${title(services)} ran`,
  });
}
