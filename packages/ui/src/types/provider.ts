import type { ReactNode } from 'react';
import type {
  FoundationConfig,
  FoundationOverrides,
  Services,
  Translator,
} from '@bitakit/core';
import type { ActionProviderProps } from '../providers/action-provider.js';
import type { FoundationLabels, FoundationUI } from './ui.js';

/** Generic host bindings. Visual and framework adapters may supply their own defaults. */
export type FoundationProviderProps = FoundationOverrides & {
  config?: FoundationConfig;
  ui: FoundationUI;
  labels: FoundationLabels;
  translate?: Translator;
  notify?: (message: string, kind: 'success' | 'failure') => unknown;
  services?: Partial<Services>;
  actionOptions?: Omit<ActionProviderProps, 'children'>;
  /**
   * Keep the app running when a plugin fails to start: the plugin and its dependents are
   * turned off and a dialog explains the error. Defaults to on in development builds only.
   */
  isolateFailures?: boolean;
  children: ReactNode;
};
