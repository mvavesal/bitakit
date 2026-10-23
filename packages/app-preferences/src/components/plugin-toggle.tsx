'use client';
import { useId } from 'react';
import {
  Action,
  useAction,
  useBitaKit,
  useRuntimeInventory,
  pluginManagementAction,
  pluginChangeExplanation,
  type PluginChangeInput,
} from '@bitakit/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@bitakit/ui/components';
import { Switch } from './ui/switch.js';
import { pluginId } from '../id.js';

/** Bind the host Action; Core owns status, dependency planning and all execution guards. */
export function PluginToggle({ id, name }: { id: string; name: string }) {
  const { runtime } = useBitaKit();
  const inventory = useRuntimeInventory();
  const descriptionId = useId();
  const state = inventory.live?.plugins.find((entry) => entry.id === id);
  const enabled = inventory.static.plugins.find((entry) => entry.id === id)?.enabled;
  const input: PluginChangeInput = {
    id,
    operation: enabled && state?.phase !== 'failed' ? 'disable' : 'enable',
    expectedRevision: runtime.getRevision(),
    preserve: [pluginId, 'shell'],
  };
  const control = useAction(pluginManagementAction, input);
  if (!state || !control) return null;
  const preview = runtime.plugins.preview(
    input.operation === 'disable'
      ? { ...input, operation: 'disable', dependents: 'stop' }
      : { ...input, operation: 'enable' },
  );
  const reason = pluginChangeExplanation(runtime, preview);
  const label = `${control.title} ${name}`;
  const button = (
    <Action id={control}>
      <Switch
        checked={enabled === true && state.phase !== 'failed'}
        aria-label={label}
        aria-describedby={reason ? descriptionId : undefined}
      />
    </Action>
  );
  return (
    <div className="shrink-0 pe-3">
      {reason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                aria-label={label}
                aria-describedby={descriptionId}
                className="inline-flex"
              >
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
          </Tooltip>
          <span id={descriptionId} className="sr-only">
            {reason}
          </span>
        </TooltipProvider>
      ) : (
        button
      )}
    </div>
  );
}

/** Action failures stay available after a settings projection is restarted. */
export function PluginChangeFeedback() {
  const control = useAction(pluginManagementAction);
  return control?.error instanceof Error ? (
    <p role="alert" className="text-sm text-destructive">
      {control.error.message}
    </p>
  ) : null;
}
