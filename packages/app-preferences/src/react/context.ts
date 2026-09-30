import { createContext } from 'react';
import type { Setting } from '../fields/setting.js';
import type { SettingsSection } from '../catalog/section.js';
import type { RendererSnapshot } from '../renderers/registry.js';
import type { SettingsTranslator } from '../text.js';
import type { SettingsMessages } from './messages.js';

/** Static contributions visible before a Foundation runtime mounts, so SSR matches later renders. */
export type SettingsStaticState = Readonly<{
  settings: ReadonlySet<Setting<any>>;
  owners(key: string): readonly string[];
  sections: readonly SettingsSection[];
}>;
export type SettingsUIValue = Readonly<{
  renderers: RendererSnapshot;
  translate?: SettingsTranslator;
  messages: SettingsMessages;
  /** Present only until the owning runtime has installed its contributions. */
  initial?: SettingsStaticState;
}>;
export const SettingsUIContext = createContext<SettingsUIValue | null>(null);
