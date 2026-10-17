'use client';
import {
  Component,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ConfirmationController,
  BitaKitRuntime,
  createRuntimeController,
  describeStartupFailure,
  pluginExposesService,
  resolveBitaKitConfig,
  type Confirmation,
  type BitaKitRuntimeConfig,
  type Plugin,
} from '@bitakit/core';
import type { BitaKitRuntimeProviderProps } from '../types/provider.js';
import { ActionContext } from './action-context.js';
import { ActionProvider } from './action-provider.js';
import { useActionList } from '../hooks/use-action.js';
import { BitaKitContext, type SignOutIntent } from './foundation-context.js';
import { DialogHost } from '../components/dialog-host.js';
import { ConfirmDialog } from '../components/confirm-dialog.js';
import { StartupFailureDialog, type StartupFailure } from '../components/startup-failure-dialog.js';
import { standardBitaKitUI } from '../components/standard-foundation-ui.js';
import { defaultLabels } from '../components/foundation-labels.js';

const ignore = () => {};
const noServices = {};
const emptyConfig: BitaKitRuntimeConfig = {};

/** Owns the root ActionProvider, or reuses an existing host provider during migration. */
export function BitaKitRuntimeProvider({ actionOptions, controls, ...props }: BitaKitRuntimeProviderProps) {
  const actions = useContext(ActionContext);
  const content = <FoundationRuntimeProvider {...props} />;
  return actions ? (
    content
  ) : (
    <ActionProvider {...actionOptions} controls={controls ?? actionOptions?.controls}>
      {content}
    </ActionProvider>
  );
}

/** Adds configured plugins to the discovered ones; an entry with an existing ID replaces it in place. */
function withAdditional(
  base: readonly Plugin[] | undefined,
  additional: readonly Plugin[] | undefined,
) {
  if (!additional) return base;
  const current = base ?? [];
  return [
    ...current.map((plugin) => additional.find((override) => override.id === plugin.id) ?? plugin),
    ...additional.filter((plugin) => !current.some((existing) => existing.id === plugin.id)),
  ];
}

/** Mounts one runtime against the selected ActionList; configuration is immutable. */
function FoundationRuntimeProvider({
  config = emptyConfig,
  actions: explicitActions,
  plugins: explicitPlugins,
  additionalPlugins,
  interceptors,
  providers,
  ui = standardBitaKitUI,
  dialogs,
  translate,
  labels: labelOverrides,
  notify,
  services = noServices,
  isolateFailures = developing(),
  children,
}: Omit<BitaKitRuntimeProviderProps, 'actionOptions' | 'controls'>) {
  const actions = useActionList();
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const plugins = useMemo(
    () => withAdditional(explicitPlugins ?? config.plugins, additionalPlugins) ?? explicitPlugins,
    [explicitPlugins, config, additionalPlugins],
  );
  const [signOutIntent, setSignOutIntent] = useState<SignOutIntent>(null);
  const selected = useMemo(
    () =>
      resolveBitaKitConfig(config, {
        actions: explicitActions,
        plugins,
        interceptors,
        providers,
      }),
    [config, explicitActions, plugins, interceptors, providers],
  );
  const controller = useMemo(
    () =>
      createRuntimeController(selected, {
        actions,
        services,
        failures: isolateFailures ? 'isolate' : 'fail-fast',
      }),
    [selected, actions, services, isolateFailures],
  );
  const attempt = useSyncExternalStore(controller.subscribe, controller.get, controller.get);
  const previousStop = useRef<Promise<void> | undefined>(undefined);
  const [waitingForStop, setWaitingForStop] = useState(false);
  if (
    translate &&
    ((services as Readonly<Record<string, unknown>>).i18n ||
      selected.plugins?.some((plugin) =>
        Object.values(plugin.services ?? {}).some(
          (service) => service.provides === 'i18n' || service.id === 'i18n',
        ),
      ))
  )
    throw new Error('Use either a translation plugin or the translate prop, not both.');
  const [fatal, setFatal] = useState<{
    runtime?: BitaKitRuntime;
    failure: StartupFailure;
  } | null>(null);
  const runtime = attempt.runtime;
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmations = useMemo(() => new ConfirmationController(setConfirmation), []);
  useEffect(() => {
    if (runtime && translate) runtime.setTranslations(translate);
  }, [runtime, translate]);
  useEffect(() => (runtime && notify ? runtime.setNotifier(notify) : undefined), [runtime, notify]);
  useEffect(
    () => (runtime ? runtime.setConfirm(confirmations.confirm) : undefined),
    [runtime, confirmations],
  );
  useEffect(() => {
    let active = true;
    let started = false;
    const predecessor = previousStop.current;
    const report = (error: unknown) => {
      if (!active) return;
      if (!isolateFailures) {
        setFatal(() => {
          throw error;
        });
        return;
      }
      setFatal({ runtime: controller.get().runtime, failure: describeStartupFailure(error) });
    };
    const begin = () => {
      if (!active) return;
      setWaitingForStop(false);
      started = true;
      try {
        controller.mount();
      } catch (error) {
        if (!isolateFailures) throw error;
        report(error);
        return;
      }
      void controller.ready.catch(report);
    };
    if (predecessor) {
      setWaitingForStop(true);
      void predecessor.then(begin).catch(report);
    } else begin();
    return () => {
      active = false;
      setSignOutIntent(null);
      confirmations.dispose();
      const stopping = controller.stop();
      // A skipped intermediate composition must not discard the original cleanup barrier.
      previousStop.current =
        !started && predecessor ? Promise.all([predecessor, stopping]).then(() => {}) : stopping;
      // React cannot await cleanup; the next effect observes this same completion before mount.
      void previousStop.current.catch(() => {});
    };
  }, [controller]);
  const failures =
    fatal &&
    fatal.runtime === runtime &&
    !attempt.failures.some((item) => item.message === fatal.failure.message)
      ? [...attempt.failures, fatal.failure]
      : attempt.failures;
  const report = failures.map((failure) => failure.message).join('\n');
  useEffect(() => {
    for (const failure of failures) console.error(`[bitakit] ${failure.message}`);
  }, [report]);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const failedIds = new Set(failures.map((failure) => failure.plugin));
  const healthy = runtime && !failures.some((failure) => failure.app);
  const turnedOff = (error: unknown): TurnedOff | undefined => {
    const service = unavailableService(error);
    const plugin =
      service &&
      (plugins ?? config.plugins ?? []).find(
        (plugin) =>
          (attempt.blocked.includes(plugin.id) || failedIds.has(plugin.id)) &&
          pluginExposesService(plugin, service),
      );
    return plugin ? { service, plugin: plugin.id, failed: failedIds.has(plugin.id) } : undefined;
  };
  return (
    <>
      {healthy ? (
        <BitaKitContext.Provider
          value={{
            runtime,
            transition: waitingForStop ? 'stopping' : undefined,
            ui,
            dialogs,
            labels,
            notify: notify ?? ignore,
            signOutIntent,
            setSignOutIntent,
          }}
        >
          {(runtime.config.ui?.providers ?? []).reduceRight<ReactNode>(
            (content, provider) =>
              createElement(provider.component, { children: content, key: provider.id }),
            <>
              {isolateFailures ? (
                <TurnedOffServiceBoundary key={report} turnedOff={turnedOff}>
                  {children}
                </TurnedOffServiceBoundary>
              ) : (
                children
              )}
              <DialogHost />
              <ConfirmDialog request={confirmation} onAnswer={confirmations.answer} />
            </>,
          )}
        </BitaKitContext.Provider>
      ) : null}
      {failures.length && dismissed !== report ? (
        <StartupFailureDialog
          ui={ui}
          failures={failures}
          dependents={attempt.blocked}
          onDismiss={() => setDismissed(report)}
        />
      ) : null}
    </>
  );
}

declare const process: { env: Record<string, string | undefined> };
function developing() {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
type TurnedOff = { service: string; plugin: string; failed: boolean };
const explain = ({ service, plugin, failed }: TurnedOff) =>
  `A component on this page requires the service "${service}" from plugin "${plugin}", which was turned off because ${failed ? 'it failed to start' : 'it depends on a plugin that failed to start'}.`;
/** Development only: a page that still requires a service of a turned-off plugin shows what happened. */
class TurnedOffServiceBoundary extends Component<
  { turnedOff(error: unknown): TurnedOff | undefined; children: ReactNode },
  { caught: boolean; error?: unknown }
> {
  state = { caught: false, error: undefined as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { caught: true, error };
  }
  componentDidCatch(error: unknown) {
    const missing = this.props.turnedOff(error);
    if (missing) console.error(`[bitakit] ${explain(missing)}`);
  }
  render() {
    if (!this.state.caught) return this.props.children;
    const missing = this.props.turnedOff(this.state.error);
    if (!missing) throw this.state.error;
    return (
      <div role="alert" className="wrap-anywhere">
        <p>{explain(missing)}</p>
        <p>Fix the plugin error, or check app.has({`'${missing.service}'`}) before reading it.</p>
      </div>
    );
  }
}
function unavailableService(error: unknown) {
  if (!(error instanceof Error) || error.name !== 'BitaKitServiceError') return undefined;
  const { service } = error as Error & { service?: unknown };
  return typeof service === 'string' ? service : undefined;
}
