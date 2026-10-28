import { defineAction } from '@bitakit/core';
import BellIcon from 'reicon-react/icons/Bell';
import HeartIcon from 'reicon-react/icons/Heart';
import RocketIcon from 'reicon-react/icons/Rocket';
import StarIcon from 'reicon-react/icons/Star';
import { wait } from './actions/-wait';

export const icons = { star: StarIcon, heart: HeartIcon, rocket: RocketIcon, bell: BellIcon };

export type Place = 'toolbar' | 'navigation';

/** What you set in the first example, for one live Action. */
export type LiveConfig = {
  /** 1, 2, 3…: names the Action and its shortcut, Alt+number. */
  number: number;
  places: Place[];
  title: string;
  tooltip: string;
  icon: keyof typeof icons;
  enabled: boolean;
  visible: boolean;
  confirm: boolean;
  slow: boolean;
  message: string;
};

/**
 * One live Action, made from one configuration: an ordinary defineAction with plain values.
 * ui/providers/live.tsx adds it to the app while it runs, and replaces it after every edit.
 */
export function liveAction(config: LiveConfig) {
  const title = config.title || 'Untitled';
  return defineAction<Place | undefined>({
    // How it looks.
    title,
    tooltip: config.tooltip || undefined,
    icon: icons[config.icon],

    // Where it shows. Each place passes its name as input, and `visible` keeps the ticked
    // ones. The example's own card passes no input, so it always shows the Action.
    slots: [
      { slot: 'shell.toolbar', order: config.number, input: () => 'toolbar' },
      { slot: 'shell.navigation', order: -10 + config.number, input: () => 'navigation' },
    ],
    groups: ['playground.live'],
    visible: ({ input }) =>
      config.visible && (input === undefined || config.places.includes(input)),

    // How it behaves.
    enabled: config.enabled,
    shortcut: { keys: `Alt+${config.number}` },
    confirm: config.confirm && { title: `Run ${title}?`, description: 'Ask first is on.' },
    execute: ({ signal }) => (config.slow ? wait(1000, signal) : undefined),
    success: config.message || `${title} ran`,
  });
}
