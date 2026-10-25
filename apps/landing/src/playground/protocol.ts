import type { Locale } from '@/i18n/config';

/**
 * Messages between the landing page (parent) and the playground app (iframe, same origin).
 * Every command is applied inside the playground through BitaKit's public APIs; the parent
 * never touches the app's DOM. Both sides check origin and source before reading a message.
 */
export type PlaygroundCommand =
  | { type: 'bitakit:hello' }
  | { type: 'bitakit:setting'; key: string; value: unknown }
  | { type: 'bitakit:theme'; key: string }
  | { type: 'bitakit:plugin'; id: string; enabled: boolean }
  | { type: 'bitakit:locale'; locale: Locale }
  | { type: 'bitakit:navigate'; href: string }
  | { type: 'bitakit:reset' };

export type PlaygroundPlugin = { id: string; enabled: boolean };

export type PlaygroundState = {
  type: 'bitakit:state';
  path: string;
  locale: string;
  settings: Record<string, unknown>;
  themes: { key: string; name: string }[];
  theme: string;
  plugins: PlaygroundPlugin[];
};

/** The plugins the panel can switch, in start order: Goals needs Pipeline. */
export const switchablePlugins = [
  'revenue',
  'pipeline',
  'goals',
  'activity',
  'contacts',
  'guard',
  'quick-search',
] as const;

/** Resettable demo settings and their initial values. */
export const defaults = {
  settings: {
    'shell.mode': 'light',
    'shell.layout': 'sidebar',
    'shell.density': 'comfortable',
    'shell.corners': 'default',
    currency: 'USD',
    'revenue.range': '12',
    'goals.target': '200000',
  } as Record<string, string>,
  theme: 'shell:default',
  locale: 'en',
  path: '/dashboard',
} as const;
