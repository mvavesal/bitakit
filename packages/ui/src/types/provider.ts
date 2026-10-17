import type { ReactNode } from 'react';
import type { BitaKitRuntimeConfig, BitaKitOverrides, Plugin, Translator } from '@bitakit/core';
import type { ActionProviderProps } from '../providers/action-provider.js';
import type { ControlAdapters } from '../hooks/use-action.js';
import type { DialogFrame, BitaKitLabels, BitaKitUI } from './ui.js';

/** The one provider. Standard visuals and labels apply unless a host supplies its own. */
export type BitaKitRuntimeProviderProps = BitaKitOverrides & {
  /** The generated configuration (`createBitaKitConfig()`), or an explicit one. */
  config?: BitaKitRuntimeConfig;
  /** Plugins added to the configuration; an entry with an existing ID replaces that plugin in place. */
  additionalPlugins?: readonly Plugin[];
  ui?: BitaKitUI;
  /** Frames for `dialog: { kind }` beyond the default dialog, for example `{ sheet: SheetFrame }`. */
  dialogs?: Readonly<Record<string, DialogFrame>>;
  labels?: Partial<BitaKitLabels>;
  translate?: Translator;
  notify?: (message: string, kind: 'success' | 'failure') => unknown;
  /** Host services under their contract names, such as `{ auth }`. */
  services?: Readonly<Record<string, unknown>>;
  /** Prop-name adapters for the host's component library. */
  controls?: ControlAdapters;
  actionOptions?: Omit<ActionProviderProps, 'children'>;
  /**
   * Keep the app running when a plugin fails to start: the plugin and its dependents are
   * turned off and a dialog explains the error. Defaults to on in development builds only.
   */
  isolateFailures?: boolean;
  children: ReactNode;
};
