'use client';
import {
  Component,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ConfirmationController,
  FoundationRuntime,
  isFoundationStartupError,
  resolveFoundationConfig,
  type Confirmation,
  type FoundationConfig,
  type Plugin,
} from '@bitakit/core';
import type { FoundationProviderProps } from '../types/provider.js';
import { ActionContext } from './action-context.js';
import { ActionProvider } from './action-provider.js';
import { useActionList } from '../hooks/use-action.js';
import { FoundationContext, type SignOutIntent } from './foundation-context.js';
import { DialogHost } from '../components/dialog-host.js';
import { ConfirmDialog } from '../components/confirm-dialog.js';
import { StartupFailureDialog, type StartupFailure } from '../components/startup-failure-dialog.js';
import { standardFoundationUI } from '../components/standard-foundation-ui.js';
import { defaultLabels } from '../components/foundation-labels.js';

const ignore = () => {};
const noServices = {};
const emptyConfig: FoundationConfig = {};

/** Owns the root ActionProvider, or reuses an existing host provider during migration. */
export function FoundationProvider({ actionOptions, controls, ...props }: FoundationProviderProps) {
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
  ui = standardFoundationUI,
  translate,
  labels: labelOverrides,
  notify,
  services = noServices,
  isolateFailures = developing(),
  children,
}: Omit<FoundationProviderProps, 'actionOptions' | 'controls'>) {
  const actions = useActionList();
  const labels = useMemo(() => ({ ...defaultLabels, ...labelOverrides }), [labelOverrides]);
  const plugins = useMemo(
    () => withAdditional(explicitPlugins ?? config.plugins, additionalPlugins) ?? explicitPlugins,
    [explicitPlugins, config, additionalPlugins],
  );
  const [signOutIntent, setSignOutIntent] = useState<SignOutIntent>(null);
  // Failures found after mount; they apply only to the composition that produced them.
  const [isolation, setIsolation] = useState<Isolation | null>(null);
  const known =
    isolation && isolation.config === config && isolation.plugins === plugins
      ? isolation.failures
      : noFailures;
  const attempt = useMemo(() => {
    const failed = [...known];
    for (;;) {
      const { active, off } = withoutFailed(plugins ?? config.plugins ?? [], failed);
      try {
        const selected = resolveFoundationConfig(config, {
          actions: explicitActions,
          plugins: failed.length ? active : plugins,
          interceptors,
          providers,
        });
        return {
          selected,
          runtime: new FoundationRuntime(actions, selected, services),
          failed,
          off,
        };
      } catch (error) {
        if (!isolateFailures) throw error;
        const failure = describeFailure(error);
        // Construction errors that name a plugin are retried without it; others are fatal.
        if (failure.app || failed.some((item) => item.plugin === failure.plugin))
          return { failed: [...failed, failure], off };
        failed.push(failure);
      }
    }
  }, [
    config,
    explicitActions,
    plugins,
    interceptors,
    providers,
    actions,
    services,
    known,
    isolateFailures,
  ]);
  if (
    translate &&
    (services.i18n ||
      attempt.selected?.plugins?.some((plugin) =>
        Object.values(plugin.services ?? {}).some(
          (service) => service.provides === 'i18n' || service.id === 'i18n',
        ),
      ))
  )
    throw new Error('Use either a translation plugin or the translate prop, not both.');
  const [fatal, setFatal] = useState<{
    runtime: FoundationRuntime;
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
    if (!runtime) return;
    let stop: () => void;
    let active = true;
    const report = (error: unknown) => {
      if (!active) return;
      if (!isolateFailures) throw error;
      const failure = describeFailure(error);
      if (failure.app || attempt.failed.some((item) => item.plugin === failure.plugin))
        setFatal({ runtime, failure });
      else setIsolation({ config, plugins, failures: [...attempt.failed, failure] });
    };
    try {
      stop = runtime.mount();
    } catch (error) {
      report(error);
      return;
    }
    // Asynchronous start hooks may fail after mount; isolate those plugins the same way. Without
    // isolation the failure is rethrown from the next render, as synchronous startup errors are,
    // instead of becoming an unhandled rejection.
    runtime.ready.catch((error) => {
      if (!active) return;
      if (isolateFailures) report(error);
      else
        setFatal(() => {
          throw error;
        });
    });
    return () => {
      active = false;
      setSignOutIntent(null);
      confirmations.dispose();
      stop();
    };
  }, [runtime]);
  const failures =
    fatal && fatal.runtime === runtime ? [...attempt.failed, fatal.failure] : attempt.failed;
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
        (plugin) => attempt.off.has(plugin.id) && exposes(plugin, service),
      );
    return plugin ? { service, plugin: plugin.id, failed: failedIds.has(plugin.id) } : undefined;
  };
  return (
    <>
      {healthy ? (
        <FoundationContext.Provider
          value={{ runtime, ui, labels, notify: notify ?? ignore, signOutIntent, setSignOutIntent }}
        >
          {(attempt.selected.providers ?? []).reduceRight<ReactNode>(
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
        </FoundationContext.Provider>
      ) : null}
      {failures.length && dismissed !== report ? (
        <StartupFailureDialog
          ui={ui}
          failures={failures}
          dependents={[...attempt.off].filter((id) => !failedIds.has(id))}
          onDismiss={() => setDismissed(report)}
        />
      ) : null}
    </>
  );
}

type Isolation = {
  config: FoundationConfig;
  plugins: readonly Plugin[] | undefined;
  failures: readonly StartupFailure[];
};
const noFailures: readonly StartupFailure[] = [];
declare const process: { env: Record<string, string | undefined> };
function developing() {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
function describeFailure(error: unknown): StartupFailure {
  if (isFoundationStartupError(error))
    return { plugin: error.plugin, app: error.app, message: error.message, source: error.source };
  return {
    plugin: 'app',
    app: true,
    message: error instanceof Error ? error.message : String(error),
  };
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
  if (!(error instanceof Error) || error.name !== 'FoundationServiceError') return undefined;
  const { service } = error as Error & { service?: unknown };
  return typeof service === 'string' ? service : undefined;
}
/** Whether `plugin` exposes `name`, as a service ID or alias, or as the namespace above one. */
function exposes(plugin: Plugin, name: string) {
  const services = Array.isArray(plugin.services)
    ? plugin.services
    : Object.values(plugin.services ?? {});
  const names = [
    ...Object.keys(plugin.publicServices ?? {}),
    ...services.flatMap((service) =>
      [service.id, service.exposeAs, service.provides as string | undefined].filter(
        (item): item is string => !!item,
      ),
    ),
    plugin.id,
  ];
  return names.some(
    (exposed) =>
      exposed === name || name.startsWith(`${exposed}.`) || exposed.startsWith(`${name}.`),
  );
}
/** Removes failed plugins and, transitively, the plugins that depend on them. */
function withoutFailed(plugins: readonly Plugin[], failed: readonly StartupFailure[]) {
  const off = new Set(failed.map((failure) => failure.plugin));
  for (let changed = true; changed; ) {
    changed = false;
    for (const plugin of plugins)
      if (!off.has(plugin.id) && plugin.dependencies?.some((id) => off.has(id))) {
        off.add(plugin.id);
        changed = true;
      }
  }
  return { active: plugins.filter((plugin) => !off.has(plugin.id)), off };
}
