import { z } from 'zod';
import {
  defineAction,
  type BitaKitRuntime,
  type PluginChangePreview,
  type PluginToggleRequest,
  type PluginUpdateResult,
} from '@bitakit/core';

const inputSchema = z.object({
  id: z.string().min(1),
  operation: z.enum(['enable', 'disable']),
  expectedRevision: z.number().int().nonnegative(),
  preserve: z.array(z.string()).default([]),
});
export type PluginChangeInput = z.input<typeof inputSchema>;
export const pluginManagementAction = 'runtime.plugins.change' as const;
declare module '@bitakit/core' {
  interface ActionMap {
    'runtime.plugins.change': { input: PluginChangeInput; result: PluginUpdateResult };
  }
}

const reasonText = {
  busy: 'Another change is in progress. Try again when it finishes.',
  'cleanup-failed':
    'Cleanup failed. Recover the resources and reload the application before retrying.',
  stale: 'The plugins changed. Review this operation again.',
  protected: 'Required by this management page; it must remain enabled.',
  dependents: 'Other enabled plugins depend on this plugin.',
  'owner-disabled': 'Enable the parent plugin first.',
  composition: 'Changing this plugin requires restarting the application with a new configuration.',
  invalid:
    'This change is unavailable in the current plugin configuration. Check its dependencies.',
  'pending-settings': 'Wait for settings to finish saving before changing this plugin.',
} as const;

/** Safe, translated presentation of the planner's reason; raw lifecycle causes stay diagnostic. */
export function pluginChangeExplanation(
  runtime: BitaKitRuntime,
  preview: PluginChangePreview,
): string | undefined {
  return preview.reason
    ? runtime.text(`foundationUI.plugins.${preview.reason}`, reasonText[preview.reason])
    : undefined;
}

function request(input: PluginChangeInput): PluginToggleRequest {
  return input.operation === 'disable'
    ? { ...input, operation: 'disable', dependents: 'stop' }
    : { ...input, operation: 'enable' };
}
function pluginName(runtime: BitaKitRuntime, id: string) {
  return runtime.text(
    `plugins.${id}.name`,
    runtime.config.plugins?.find((plugin) => plugin.id === id)?.metadata?.name ?? id,
  );
}
class PluginManagementError extends Error {}

/** Host-owned Action survives plugin projection restarts and uses the root adapter/confirmation. */
export function bindPluginManagement(runtime: BitaKitRuntime): () => void {
  const text = (key: string, fallback: string, values?: Record<string, string>) =>
    runtime.text(`foundationUI.plugins.${key}`, fallback, values);
  const release = runtime.bindHostAction(
    pluginManagementAction,
    defineAction({
      input: inputSchema,
      internal: true,
      concurrency: 'per-input',
      concurrencyKey: (input) => input?.id ?? '',
      title: ({ input }) =>
        input?.operation === 'enable' ? text('enable', 'Enable') : text('disable', 'Disable'),
      enabled: ({ input }) => !!input && runtime.plugins.preview(request(input)).status === 'ready',
      confirm: ({ input }) => {
        if (!input || input.operation !== 'disable') return false;
        const preview = runtime.plugins.preview(request(input));
        if (preview.status !== 'ready') return false;
        const name = pluginName(runtime, input.id);
        const others = preview.changed
          .filter((id) => id !== input.id)
          .map((id) => pluginName(runtime, id))
          .join(', ');
        return {
          title: text('confirmTitle', `Disable ${name}?`, { name }),
          description: others
            ? text(
                'confirmDependents',
                `This also disables: ${others}. You can enable these plugins again here. This change lasts until the application reloads.`,
                { plugins: others },
              )
            : text(
                'confirmDescription',
                'You can enable this plugin again here. This change lasts until the application reloads.',
              ),
        };
      },
      execute: async ({ input }) => {
        const change = request(input);
        const preview = runtime.plugins.preview(change);
        if (preview.status !== 'ready')
          throw new PluginManagementError(pluginChangeExplanation(runtime, preview));
        const result =
          change.operation === 'disable'
            ? await runtime.plugins.disable(change.id, change)
            : await runtime.plugins.enable(change.id, change);
        if (result.status !== 'applied') {
          const name = pluginName(runtime, input.id);
          throw new PluginManagementError(
            text(
              'failed',
              `Could not change ${name}. Check the plugin status and retry; failed cleanup requires a reload.`,
              { name },
            ),
            { cause: result },
          );
        }
        return result;
      },
      failure: ({ error }) =>
        error instanceof PluginManagementError
          ? error.message
          : text('unexpected', 'The plugin change failed. Review its status before retrying.'),
    }),
  );
  const refresh = runtime.lifecycle.subscribe(() => runtime.actions.refresh());
  return () => {
    refresh();
    release();
  };
}
