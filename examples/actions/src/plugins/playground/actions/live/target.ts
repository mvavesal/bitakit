import { defineAction, type Services } from '@bitakit/core';
import LiveIcon from '../../ui/live-icon';

const live = (services: Services) => services.playground.live.state.get();

// One Action in four places: the sidebar, the app bar, the More menu and the live card. Each
// field reads the playground.live service, so the controls only change that state and every
// place updates by itself. No control touches this Action.
export default defineAction({
  title: ({ services }) => live(services).title,
  tooltip: ({ services }) => live(services).tooltip || undefined,
  enabled: ({ services }) => live(services).enabled,
  visible: ({ services }) => live(services).visible,
  icon: LiveIcon,
  slots: [{ slot: 'shell.navigation', order: -5 }, 'shell.toolbar'],
  groups: ['playground.more'],
  execute: ({ services }) => services.playground.live.click(),
  success: ({ services }) => `${live(services).title} ran`,
});
