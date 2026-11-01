import { getPluginOrigin, withPluginOrigin, type BitaKitRuntime, type Plugin } from '@bitakit/core';
import type { PackageHostResult, PackageRequest, PackageSelection } from './index.js';
import type {
  PackageJournal,
  PackageProvider,
  PackageRecord,
  PackageSnapshot,
  PreparedPackage,
} from './artifacts.js';

export type DynamicPackageOptions = {
  provider: PackageProvider;
  journal: PackageJournal;
  /** The host/storage owner confirms code rollback does not require reversing a data migration. */
  dataCompatibility: 'unchanged';
  /** Optional browser/application health check after Core startup and before durable success. */
  health?: (plugins: readonly string[]) => Promise<void>;
};
type Loaded = {
  selection: PackageSelection;
  plugins: readonly Plugin[];
  dispose?: () => void;
  activate?: () => void;
  deactivate?: () => void;
  source?: string;
};
const empty: PackageSnapshot = { scope: null, packages: [] };
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const key = (selection: PackageSelection) =>
  `${selection.name}@${selection.version}#${selection.artifact ?? ''}`;

/** Dynamic mode of the package host. One queue owns preparation, Core transitions and journal writes. */
export function createDynamicPackageHost(runtime: BitaKitRuntime, options: DynamicPackageOptions) {
  if (!runtime.plugins.replace)
    throw new Error(
      'Dynamic package hosts require the matching Core release with plugins.replace().',
    );
  let loaded: Loaded[] = [];
  let scope: string | null = null;
  let sequence = 0;
  let pending: AbortController | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  let journalRevision: number | undefined;
  let record: PackageRecord = { active: empty };
  let recoveryRequired = false;
  let resourceCleanupFailed = false;
  let closing = false;
  let closed = false;
  const result = (
    status: PackageHostResult['status'],
    reasons: readonly string[] = [],
  ): PackageHostResult => Object.freeze({ status, scope, reasons: Object.freeze([...reasons]) });
  const snapshot = (): PackageSnapshot => ({
    scope,
    packages: loaded.map((entry) => entry.selection),
  });
  const persist = async (next: PackageRecord) => {
    journalRevision = await options.journal.write(journalRevision!, next);
    record = next;
  };
  async function initialize() {
    if (journalRevision !== undefined) return;
    const saved = await options.journal.read();
    journalRevision = saved.revision;
    record = saved.record ?? { active: empty };
    recoveryRequired = !!record.pending || !!record.active.packages.length;
  }
  const get = () =>
    Object.freeze({
      scope,
      packages: Object.freeze(
        loaded.map((entry) =>
          Object.freeze({
            ...entry.selection,
            plugins: Object.freeze(
              entry.plugins.map((plugin) =>
                Object.freeze({
                  id: plugin.id,
                  ready: runtime.isReady(plugin.id),
                  phase:
                    runtime.lifecycle.get().plugins.find((item) => item.id === plugin.id)?.phase ??
                    'idle',
                }),
              ),
            ),
          }),
        ),
      ),
    });
  const isBusy = () => !!runtime.lifecycle.get().operation || !runtime.isReady();
  // Providers may not be cancellable (native module imports). Release the queue on supersession.
  const cancellable = <T>(work: Promise<T>, signal: AbortSignal): Promise<T> =>
    new Promise((resolve, reject) => {
      const abort = () => reject(new Error('Package preparation superseded.'));
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });

  async function apply(
    request: PackageRequest,
    token: number,
    signal: AbortSignal,
    recover: boolean,
  ) {
    const current = () => token === sequence && !signal.aborted;
    const acquired: Loaded[] = [];
    let committed = false;
    try {
      await initialize();
      if (!current()) return result('superseded');
      if (recoveryRequired && !recover)
        return result('blocked', ['Call recover() before changing a persisted installation.']);
      if (recover && !record.pending && !record.active.packages.length && !loaded.length) {
        scope = record.active.scope;
        recoveryRequired = false;
        return result('applied');
      }
      if (recover) {
        const target = record.pending?.before ?? record.active;
        request = { scope: target.scope ?? request.scope, packages: target.packages };
      }
      const selections = request.packages.map((entry) => ({
        ...entry,
        name: entry.name.toLowerCase(),
      }));
      if (new Set(selections.map((entry) => entry.name)).size !== selections.length)
        return result('blocked', ['Select each package once.']);
      const prepared = await cancellable(
        Promise.all(selections.map((selection) => options.provider.resolve(selection, signal))),
        signal,
      );
      if (!current()) return result('superseded');
      const before = snapshot();
      const nextSelections = prepared.map(({ artifact }, i) => {
        const wanted = selections[i];
        if (
          artifact.name !== wanted.name ||
          artifact.version !== wanted.version ||
          (wanted.artifact && artifact.id !== wanted.artifact)
        )
          throw new Error(`Resolved artifact does not match ${wanted.name}@${wanted.version}.`);
        if (
          !artifact.pluginIds.length ||
          new Set(artifact.pluginIds).size !== artifact.pluginIds.length
        )
          throw new Error(`Artifact ${artifact.id} must declare every plugin ID exactly once.`);
        return { name: artifact.name, version: artifact.version, artifact: artifact.id };
      });
      const unchanged = (index: number) =>
        !recover && scope === request.scope
          ? loaded.find(
              (entry) =>
                key(entry.selection) === key(nextSelections[index]) &&
                entry.plugins.every((p) => runtime.isReady(p.id)),
            )
          : undefined;
      const retained = prepared.map((_, i) => unchanged(i));
      const outgoing = loaded.filter((entry) => !retained.includes(entry));
      const oldIds = outgoing.flatMap((entry) => entry.plugins.map((p) => p.id));
      const owners = new Set([
        runtime.config.appId ?? 'app',
        ...(runtime.config.plugins ?? [])
          .filter((p) => !loaded.some((entry) => entry.plugins.includes(p)))
          .map((p) => p.id),
      ]);
      for (const { artifact } of prepared)
        for (const id of artifact.pluginIds) {
          if (owners.has(id)) return result('blocked', [`Plugin ID "${id}" is already owned.`]);
          owners.add(id);
        }
      for (let i = 0; i < prepared.length; i++) {
        const previous = loaded.find((entry) => entry.selection.name === nextSelections[i].name);
        if (previous?.source && previous.source !== prepared[i].artifact.source)
          return result('blocked', ['Remove the installed package before changing its source.']);
      }
      const revision = runtime.getRevision();
      const next: Loaded[] = [];
      for (let i = 0; i < prepared.length; i++) {
        if (retained[i]) {
          next.push(retained[i]!);
          continue;
        }
        const item: PreparedPackage = prepared[i];
        const imported = await cancellable(
          item.load(signal).then((value) => {
            if (signal.aborted) {
              value.dispose?.();
              throw new Error('Package preparation superseded.');
            }
            return value;
          }),
          signal,
        );
        const entry: Loaded = {
          selection: nextSelections[i],
          plugins: [],
          dispose: imported.dispose,
          activate: imported.activate,
          deactivate: imported.deactivate,
          source: item.artifact.source,
        };
        acquired.push(entry);
        const ids = imported.plugins.map((p) => p.id);
        if (
          ids.length !== item.artifact.pluginIds.length ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !item.artifact.pluginIds.includes(id))
        )
          throw new Error(`Loaded plugin IDs do not match artifact ${item.artifact.id}.`);
        entry.plugins = imported.plugins.map((plugin) =>
          withPluginOrigin(plugin, {
            ...getPluginOrigin(plugin),
            kind: 'package',
            package: { name: entry.selection.name, version: entry.selection.version },
          }),
        );
        next.push(entry);
      }
      if (!current()) return result('superseded');
      const candidate = acquired.flatMap((entry) => entry.plugins);
      const preview = runtime.plugins.preview({
        operation: 'replace',
        ids: oldIds,
        plugins: candidate,
        expectedRevision: revision,
      });
      if (preview.status !== 'ready') return result(preview.status, preview.reasons);
      if (!oldIds.length && !candidate.length && scope === request.scope && !recover)
        return result('applied');
      const after: PackageSnapshot = { scope: request.scope, packages: nextSelections };
      // Persist before teardown. A process interruption always recovers the recorded predecessor.
      await persist({
        ...record,
        pending: { before: recover ? (record.pending?.before ?? record.active) : before, after },
      });
      committed = true;
      const change = await runtime.plugins.replace(oldIds, candidate, {
        expectedRevision: revision,
      });
      let failure =
        change.status === 'applied' ? undefined : change.reasons.join('; ') || change.status;
      if (!failure) {
        try {
          for (const entry of outgoing) entry.deactivate?.();
          for (const entry of acquired) entry.activate?.();
          await options.health?.(candidate.map((p) => p.id));
        } catch (error) {
          failure = message(error);
        }
      }
      if (!failure) {
        try {
          await persist({ active: after, previous: recover ? record.previous : before });
        } catch (error) {
          failure = `Could not commit activation: ${message(error)}`;
        }
      }
      if (!failure) {
        loaded = next;
        scope = request.scope;
        recoveryRequired = false;
        acquired.length = 0;
        const errors: string[] = [];
        for (const entry of outgoing) {
          try {
            entry.dispose?.();
          } catch (error) {
            errors.push(message(error));
          }
        }
        if (errors.length) {
          resourceCleanupFailed = true;
          return result('failed', [
            'Activation committed, but previous resource cleanup failed. Recover those resources before creating a new host.',
            ...errors,
          ]);
        }
        return result('applied');
      }
      // Core may have rejected before mutation, failed startup, or failed cleanup. Inspect actual
      // references; never assume a returned failure means the candidate owns the IDs.
      const installed = runtime.config.plugins ?? [];
      const candidateIds = candidate.filter((p) => installed.includes(p)).map((p) => p.id);
      const oldStillInstalled =
        candidateIds.length === 0 &&
        outgoing.every((entry) =>
          entry.plugins.every((p) => installed.includes(p) && runtime.isReady(p.id)),
        );
      const rollback = oldStillInstalled
        ? { status: 'applied', reasons: [] }
        : await runtime.plugins.replace(
            candidateIds.length ? candidateIds : oldIds,
            outgoing.flatMap((entry) => entry.plugins),
          );
      let rollbackFailure = rollback.status === 'applied' ? undefined : rollback.reasons.join('; ');
      if (!rollbackFailure) {
        try {
          for (const entry of outgoing) entry.activate?.();
          for (const entry of acquired) entry.dispose?.();
          acquired.length = 0;
          await options.health?.(outgoing.flatMap((entry) => entry.plugins.map((p) => p.id)));
        } catch (error) {
          rollbackFailure = message(error);
        }
      }
      if (rollbackFailure) {
        recoveryRequired = true;
        loaded = [
          ...retained.filter((entry): entry is Loaded => !!entry),
          ...[...outgoing, ...acquired].filter((entry) =>
            entry.plugins.every((p) => runtime.config.plugins?.includes(p)),
          ),
        ];
        scope = candidate.some((p) => runtime.config.plugins?.includes(p))
          ? request.scope
          : before.scope;
        // Resources for definitions that could not be cleaned up must remain owned.
        for (let i = acquired.length - 1; i >= 0; i--)
          if (loaded.includes(acquired[i])) acquired.splice(i, 1);
        await persist({ ...record, failure: `${failure}; recovery failed: ${rollbackFailure}` });
        return result('failed', [record.failure!]);
      }
      if (recover) {
        recoveryRequired = true;
        await persist({ ...record, failure });
        return result('failed', [failure!, 'Persisted recovery remains pending.']);
      }
      await persist({ active: before, previous: record.previous, failure });
      recoveryRequired = false;
      return result('failed', [failure!, 'Previous package selection restored.']);
    } catch (error) {
      if (committed) recoveryRequired = true;
      return !committed && !current() ? result('superseded') : result('failed', [message(error)]);
    } finally {
      for (const entry of acquired) if (!loaded.includes(entry)) entry.dispose?.();
    }
  }
  function enqueue(request: PackageRequest, recover = false) {
    if (closing || closed)
      return Promise.resolve(result('blocked', ['This package host is closing or disposed.']));
    if (resourceCleanupFailed)
      return Promise.resolve(
        result('blocked', [
          'Previous resource cleanup failed; external recovery and a new host are required.',
        ]),
      );
    if (isBusy())
      return Promise.resolve(
        result('blocked', ['Wait for the runtime lifecycle operation to settle.']),
      );
    const token = ++sequence;
    pending?.abort();
    const controller = (pending = new AbortController());
    const copied = { ...request, packages: request.packages.map((entry) => ({ ...entry })) };
    const work = tail.then(() => apply(copied, token, controller.signal, recover));
    tail = work.catch(() => {});
    return work;
  }
  /** Release this session without uninstalling its durable selection. Call outside owned work. */
  function dispose(): Promise<PackageHostResult> {
    if (closed) return Promise.resolve(result('applied'));
    if (closing || runtime.lifecycle.get().operation)
      return Promise.resolve(
        result('blocked', ['Wait for the current operation before disposing the package host.']),
      );
    closing = true;
    ++sequence;
    pending?.abort();
    const work = tail.then(async () => {
      try {
        if (resourceCleanupFailed || runtime.lifecycle.get().cleanup === 'failed')
          return result('blocked', ['Failed cleanup requires external recovery.']);
        if (runtime.isReady()) {
          const removed = await runtime.plugins.replace(
            loaded.flatMap((entry) => entry.plugins.map((p) => p.id)),
            [],
          );
          if (removed.status !== 'applied') return result(removed.status, removed.reasons);
        } else if (runtime.lifecycle.get().phase !== 'stopped') {
          return result('blocked', [
            'Await runtime readiness or successful shutdown before disposal.',
          ]);
        }
        const errors: string[] = [];
        for (const entry of loaded) {
          try {
            entry.dispose?.();
          } catch (error) {
            errors.push(message(error));
          }
        }
        loaded = [];
        scope = null;
        if (errors.length) {
          resourceCleanupFailed = true;
          return result('failed', errors);
        }
        closed = true;
        return result('applied');
      } finally {
        closing = false;
      }
    });
    tail = work.catch(() => {});
    return work;
  }
  return Object.freeze({
    dispose,
    reconcile: (request: PackageRequest) => enqueue(request),
    get,
    /** Restore retained bytes on a fresh runtime. Interrupted forward activation rolls back too. */
    recover: () => enqueue({ scope: scope ?? '', packages: [] }, true),
  });
}
