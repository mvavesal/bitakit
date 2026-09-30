'use client';
import { useMemo } from 'react';
import { FoundationProvider as Provider } from '../providers/foundation-provider.js';
import type { FoundationProviderProps } from '../types/provider.js';
import { standardFoundationUI } from './standard-foundation-ui.js';
import { defaultLabels } from './foundation-labels.js';

export type StandardFoundationProviderProps = Omit<FoundationProviderProps, 'ui' | 'labels'> & {
  ui?: FoundationProviderProps['ui'];
  labels?: Partial<FoundationProviderProps['labels']>;
  /** Adds configured package plugins to discovered contributions without importing generated files. */
  additionalPlugins?: FoundationProviderProps['plugins'];
};

const emptyConfig = {};

/** Shared visual defaults and ordered plugin overrides, without framework dependencies. */
export function StandardFoundationProvider({
  config = emptyConfig,
  ui = standardFoundationUI,
  labels,
  actionOptions,
  plugins,
  additionalPlugins,
  ...props
}: StandardFoundationProviderProps) {
  const selectedConfig = config;
  const resolvedLabels = useMemo(() => ({ ...defaultLabels, ...labels }), [labels]);
  const selectedPlugins = useMemo(
    () =>
      additionalPlugins
        ? [
            ...(plugins ?? selectedConfig.plugins ?? []).map(
              (plugin) => additionalPlugins.find((override) => override.id === plugin.id) ?? plugin,
            ),
            ...additionalPlugins.filter(
              (plugin) =>
                !(plugins ?? selectedConfig.plugins ?? []).some(
                  (existing) => existing.id === plugin.id,
                ),
            ),
          ]
        : plugins,
    [plugins, selectedConfig, additionalPlugins],
  );
  return (
    <Provider
      {...props}
      config={selectedConfig}
      ui={ui}
      labels={resolvedLabels}
      plugins={selectedPlugins}
      actionOptions={actionOptions}
    />
  );
}
