import { defineAction, type Services } from '@bitakit/core';
import type { Live } from '../services/live';
import LiveIcon from '../ui/live-icon';
import { wait } from './-wait';

const live = (services: Services) => services.playground.live.state.get();

// The live Action. Every field reads the playground.live service, so a change there shows
// everywhere at once; nothing else touches this Action.
export default defineAction<Live['place'] | undefined>({
  // How it looks.
  title: ({ services }) => live(services).title || 'Untitled',
  tooltip: ({ services }) => live(services).tooltip || undefined,
  icon: LiveIcon,

  // Where it shows. Each place passes its name as input; `visible` keeps the chosen one. The
  // example's own card passes no input, so it always shows the Action.
  slots: [
    { slot: 'shell.toolbar', input: () => 'toolbar' },
    { slot: 'shell.navigation', order: -5, input: () => 'navigation' },
  ],
  visible: ({ input, services }) =>
    live(services).visible && (input === undefined || input === live(services).place),

  // How it behaves.
  enabled: ({ services }) => live(services).enabled,
  confirm: ({ services }) =>
    live(services).confirm && { title: 'Run the live Action?', description: 'Ask first is on.' },
  shortcut: { keys: 'Alt+1' },
  execute: ({ services, signal }) => (live(services).slow ? wait(1000, signal) : undefined),
  success: ({ services }) => live(services).message || 'The live Action ran',
});
