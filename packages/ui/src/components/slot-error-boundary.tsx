'use client';
import {
  isValidElement,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { UIContext } from '../providers/action-context.js';
import { useFoundation } from '../providers/foundation-context.js';
import { useTranslation } from '../hooks/use-translation.js';

type SlotLocation = { slot: string; plugin: string; contribution: string };

/** Local error reporting only; raw causes never enter Core inventory or the default fallback. */
export class SlotRenderError extends Error {
  readonly slot: string;
  readonly plugin: string;
  readonly contribution: string;
  constructor(location: SlotLocation, cause: unknown) {
    super(
      `Contribution "${location.contribution}" from plugin "${location.plugin}" failed to render in slot "${location.slot}".`,
      { cause },
    );
    this.name = 'SlotRenderError';
    this.slot = location.slot;
    this.plugin = location.plugin;
    this.contribution = location.contribution;
  }
}

export type SlotErrorFallbackProps = { error: SlotRenderError; retry(): void };
export type SlotErrorFallback = (props: SlotErrorFallbackProps) => ReactNode;
export type SlotErrorBoundaryProps = SlotLocation & {
  children: ReactNode;
  errorFallback?: SlotErrorFallback;
};

function SlotFailure({ error, retry }: SlotErrorFallbackProps) {
  const { ui } = useFoundation();
  const t = useTranslation();
  return (
    <div
      role="alert"
      data-slot-error={error.slot}
      data-slot-plugin={error.plugin}
      data-slot-contribution={error.contribution}
    >
      <p>{t('foundationUI.slot.unavailable', undefined, 'This widget could not be displayed.')}</p>
      <p>
        {error.plugin} · {error.slot}
      </p>
      <ui.Button type="button" variant="outline" onClick={retry}>
        {t('foundationUI.slot.retry', undefined, 'Try again')}
      </ui.Button>
    </div>
  );
}

/** One rendered contribution, inside any owning access boundary. It never restarts a plugin. */
export function SlotErrorBoundary({
  slot,
  plugin,
  contribution,
  children,
  errorFallback,
}: SlotErrorBoundaryProps) {
  const { runtime } = useFoundation();
  const { onError } = useContext(UIContext);
  // Normalized modules and global revision can change for unrelated owners. Use the raw owner.
  const readOwner = useCallback(
    () => runtime.config.plugins?.find((entry) => entry.id === plugin),
    [runtime, plugin],
  );
  const owner = useSyncExternalStore(runtime.lifecycle.subscribe, readOwner, readOwner);
  const component = isValidElement(children) ? children.type : undefined;
  const location = { slot, plugin, contribution };
  return (
    <ErrorBoundary
      resetKeys={[runtime, owner, slot, plugin, contribution, component]}
      onError={(cause) => {
        try {
          onError(new SlotRenderError(location, cause));
        } catch (reportingError) {
          // A host reporter cannot take away the contribution's recovery UI.
          console.error('[bitakit] Slot error reporting failed.', reportingError);
        }
      }}
      fallbackRender={({ error, resetErrorBoundary }) => {
        const props = { error: new SlotRenderError(location, error), retry: resetErrorBoundary };
        return errorFallback ? errorFallback(props) : <SlotFailure {...props} />;
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
