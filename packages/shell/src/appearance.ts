import { defineSettings, setting } from '@bitakit/core';
import SunIcon from 'reicon-react/icons/Sun';
import MoonIcon from 'reicon-react/icons/Moon';
import MonitorIcon from 'reicon-react/icons/Monitor';
import SidebarIcon from 'reicon-react/icons/Sidebar';
import NavbarIcon from 'reicon-react/icons/Window2';
import PaletteIcon from 'reicon-react/icons/Palette';
import ArrowUpIcon from 'reicon-react/icons/ArrowUp';
import ArrowUpLeftIcon from 'reicon-react/icons/ArrowUpLeft';
import ArrowUpRightIcon from 'reicon-react/icons/ArrowUpRight';
import ArrowDownIcon from 'reicon-react/icons/ArrowDown';
import ArrowDownLeftIcon from 'reicon-react/icons/ArrowDownLeft';
import ArrowDownRightIcon from 'reicon-react/icons/ArrowDownRight';
import { themeLibrarySchema, type ThemeLibrary } from './themes.js';
import type { ShellPreset } from './options.js';

export type ShellLayout = 'sidebar' | 'navbar';
export type NotificationPlacement =
  | 'top start'
  | 'top'
  | 'top end'
  | 'bottom start'
  | 'bottom'
  | 'bottom end';

/**
 * Appearance settings, shared by the Themes and Layout pages: `shell.mode` and `shell.toasts` belong to the device, the others to
 * the user. Labels and descriptions resolve from `shell.settings.*` in the Shell locales; the
 * English labels here are fallbacks. `preset` exists only when presets are configured.
 */
export function appearanceSettings(presets: readonly ShellPreset[]) {
  return defineSettings(
    {
      themeLibrary: setting({
        default: { selected: 'shell:default', custom: [] } as ThemeLibrary,
        schema: themeLibrarySchema,
        hidden: true,
      }),
      mode: setting({
        default: 'system',
        scope: 'device',
        control: 'cards',
        label: 'Color scheme',
        options: [
          { value: 'light', label: 'Light', icon: SunIcon },
          { value: 'dark', label: 'Dark', icon: MoonIcon },
          { value: 'system', label: 'System', icon: MonitorIcon },
        ],
      }),
      layout: setting({
        default: 'sidebar',
        control: 'cards',
        label: 'Navigation',
        options: [
          { value: 'sidebar', label: 'Sidebar', icon: SidebarIcon },
          { value: 'navbar', label: 'Navigation bar', icon: NavbarIcon },
        ],
      }),
      ...(presets.length
        ? {
            preset: setting({
              default: 'default',
              control: 'cards',
              label: 'Theme',
              options: [
                { value: 'default', label: 'Default' },
                ...presets.map(({ id, label }) => ({ value: id, label })),
              ],
            }),
          }
        : {}),
      density: setting({
        default: 'comfortable',
        control: 'cards',
        label: 'Density',
        options: [
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ],
      }),
      corners: setting({
        default: 'default',
        control: 'radio',
        label: 'Corners',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'round', label: 'Round' },
          { value: 'square', label: 'Square' },
        ],
      }),
      toasts: setting({
        default: 'bottom',
        scope: 'device',
        control: 'select',
        label: 'Notification position',
        options: [
          { value: 'top start', label: 'Top start', icon: ArrowUpLeftIcon },
          { value: 'top', label: 'Top center', icon: ArrowUpIcon },
          { value: 'top end', label: 'Top end', icon: ArrowUpRightIcon },
          { value: 'bottom start', label: 'Bottom start', icon: ArrowDownLeftIcon },
          { value: 'bottom', label: 'Bottom center', icon: ArrowDownIcon },
          { value: 'bottom end', label: 'Bottom end', icon: ArrowDownRightIcon },
        ],
      }),
    },
    { title: 'Themes', icon: PaletteIcon, category: 'appearance', order: -5 },
  );
}
