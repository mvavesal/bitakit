import { defineAction, type Services } from '@bitakit/core';
import type { Place } from '../../services/live';
import LiveIcon from '../../ui/live-icon';

const live = (services: Services) => services.playground.live.state.get();

// One Action, many places. Each field reads the playground.live service, so the controls only
// change that state and every place updates by itself; no control touches this Action.
// A placement passes its place as input, and `visible` shows the Action only in the chosen
// place. The live card and the More menu pass no input, so they always show it.
export default defineAction<Place | undefined>({
  title: ({ services }) => live(services).title.trim() || 'Untitled',
  tooltip: ({ services }) => live(services).tooltip || undefined,
  enabled: ({ services }) => live(services).enabled,
  visible: ({ input, services }) =>
    live(services).visible && (input === undefined || input === live(services).place),
  icon: LiveIcon,
  slots: [
    { slot: 'shell.toolbar', input: () => 'toolbar' },
    { slot: 'shell.navigation', order: -5, input: () => 'navigation' },
  ],
  groups: ['playground.more'],
  execute: ({ services }) => services.playground.live.click(),
  success: ({ services }) => `${live(services).title.trim() || 'Untitled'} ran`,
});
