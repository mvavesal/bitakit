import { defineService, safeHref, type SettingsIdentity } from '@bitakit/core';
import { emptyHistory, searchResultSchema } from './schemas.js';
import './settings.js';
import type { RegisteredSource, SearchContext, SearchEnvironment, SearchResult } from './types.js';

export type SearchRequest = {
  query: string;
  identity: SettingsIdentity;
  category: string | null;
  sources: readonly RegisteredSource[];
  environment: SearchEnvironment;
};
export type SourceResults = {
  source: RegisteredSource;
  status: 'loading' | 'ready' | 'error';
  results: readonly SearchResult[];
  recent: readonly SearchResult[];
  recentStatus: 'loading' | 'ready' | 'error';
};
export type SearchState = { request: SearchRequest | null; sources: readonly SourceResults[] };
export const emptySearch: SearchState = { request: null, sources: [] };
export const sourceEnabled = (source: RegisteredSource, overrides: Record<string, boolean>) =>
  Object.hasOwn(overrides, source.id) ? overrides[source.id] : source.source.defaultEnabled;

/** Validate source output using the shared schema and existing URL/Action guards. */
export function availableResult(
  value: unknown,
  context: Pick<SearchContext, 'actions'>,
): SearchResult | null {
  const parsed = searchResultSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if ('actionId' in result) {
    const action = context.actions.resolve(result.actionId);
    return action?.visible && !action.internal && safeHref(action.href) ? result : null;
  }
  if (!safeHref(result.href)) return null;
  // An unsafe picture address drops the picture, not the result.
  if (result.image && !safeHref(result.image.src)) {
    const { image: _image, ...rest } = result;
    return rest;
  }
  return result;
}

/** Owns transient requests only. All confirmed preferences/history live in runtime.settings. */
export const searchService = defineService(({ settings, store, onStop }) => {
  const state = store<SearchState>(emptySearch);
  const preferences = settings['quick-search'];
  let cancel = () => {};
  let stopped = false;
  let identityEpoch = 0;
  const offIdentity = preferences.history.subscribe(() => {
    if (!preferences.history.state().ready) identityEpoch++;
  });
  onStop(offIdentity);
  let writes: Promise<unknown> = Promise.resolve();
  onStop(() => {
    stopped = true;
    cancel();
    state.set(emptySearch);
  });

  const service = {
    state,
    /** Starts every enabled source independently; cleanup aborts and invalidates every late result. */
    search(request: SearchRequest) {
      cancel();
      if (stopped) return () => {};
      const controller = new AbortController();
      const { runtime, actions } = request.environment;
      const identity = request.identity;
      const overrides = preferences.sources.get();
      const history = preferences.history.get();
      const remember = preferences.historyEnabled.get();
      const context: SearchContext = {
        ...request.environment,
        query: request.query.trim(),
        signal: controller.signal,
        score: (value, keywords) =>
          request.environment.score(value, request.query.trim(), keywords),
      };
      const current = () =>
        !controller.signal.aborted &&
        !stopped &&
        runtime.settings.currentIdentity === identity &&
        preferences.sources.state().ready;
      const cleanups: (() => void)[] = [];
      const stop = () => {
        controller.abort();
        for (const cleanup of cleanups.splice(0)) cleanup();
        if (state.get().request === request) state.set(emptySearch);
      };
      cancel = stop;
      // Revoke before React's next effect, including a source disappearing during async cleanup.
      cleanups.push(runtime.slots.subscribe('quick-search.sources', stop));
      cleanups.push(
        runtime.lifecycle.subscribe(() => {
          if (!runtime.isReady('quick-search')) stop();
        }),
      );
      cleanups.push(
        runtime.settings.subscribe(() => {
          if (
            runtime.settings.currentIdentity !== identity ||
            !preferences.sources.state().ready ||
            preferences.sources.get() !== overrides ||
            preferences.historyEnabled.get() !== remember ||
            preferences.history.get() !== history
          )
            stop();
        }),
      );
      const sources = preferences.sources.state().ready
        ? request.sources.filter(
            (item) =>
              sourceEnabled(item, overrides) &&
              (!request.category || item.source.category.id === request.category),
          )
        : [];
      state.set({
        request,
        sources: sources.map((source) => ({
          source,
          status: 'loading',
          results: [],
          recent: [],
          recentStatus: 'ready',
        })),
      });
      const update = (id: string, patch: Partial<SourceResults>) => {
        if (!current()) return;
        state.set((previous) => ({
          ...previous,
          sources: previous.sources.map((entry) =>
            entry.source.id === id ? { ...entry, ...patch } : entry,
          ),
        }));
      };
      for (const registered of sources) {
        const { source, id } = registered;
        // A synchronous throw in one source is just that source's error.
        void Promise.resolve()
          .then(() => {
            if (!current()) return [];
            return source.search(context);
          })
          .then((results) => {
            if (!current()) return;
            if (!Array.isArray(results)) throw new Error('A search source must return an array.');
            update(id, {
              status: 'ready',
              results: results.flatMap((result) => {
                const valid = availableResult(result, { actions });
                return valid ? [valid] : [];
              }),
            });
          })
          .catch(() => update(id, { status: 'error', results: [] }));
        if (!context.query && remember && preferences.history.state().ready) {
          const references = history.results.filter(
            (item) =>
              item.sourceId === id && item.organizationId === (identity.organizationId ?? null),
          );
          if (!references.length) continue;
          update(id, { recentStatus: 'loading' });
          void Promise.all(
            references.map(async (reference) => {
              if (!current()) return null;
              const resolved = await source.resolve(reference.resultId, context);
              const valid = availableResult(resolved, context);
              // A resolver cannot substitute an unrelated identity for a stored reference.
              return valid?.id === reference.resultId ? valid : null;
            }),
          )
            .then((results) =>
              update(id, {
                recentStatus: 'ready',
                recent: results.filter((item) => item !== null),
              }),
            )
            .catch(() => update(id, { recentStatus: 'error', recent: [] }));
        }
      }
      return stop;
    },
    /** Serialize read/modify/write operations, checking identity again after any earlier save. */
    remember(request: SearchRequest, sourceId: string, result: SearchResult): Promise<void> {
      const { runtime } = request.environment;
      const identity = request.identity;
      const source = request.sources.find((item) => item.id === sourceId);
      const operation = writes
        .catch(() => {})
        .then(async () => {
          if (
            stopped ||
            runtime.settings.currentIdentity !== identity ||
            !source ||
            !runtime.isReady(source.plugin) ||
            !runtime.slots
              .get('quick-search.sources')
              .items.some((item) => item.id === sourceId && item.data === source.source) ||
            !preferences.historyEnabled.state().ready ||
            !preferences.historyEnabled.get() ||
            !preferences.history.state().ready ||
            !preferences.history.state().writable ||
            !sourceEnabled(source, preferences.sources.get()) ||
            !availableResult(result, request.environment)
          )
            return;
          const current = preferences.history.get();
          const organizationId = identity.organizationId ?? null;
          const query = request.query.trim();
          await preferences.history.set({
            queries: query
              ? [
                  { query, organizationId },
                  ...current.queries.filter(
                    (item) => item.query !== query || item.organizationId !== organizationId,
                  ),
                ].slice(0, 20)
              : current.queries,
            results: [
              { sourceId, resultId: result.id, organizationId },
              ...current.results.filter(
                (item) =>
                  item.sourceId !== sourceId ||
                  item.resultId !== result.id ||
                  item.organizationId !== organizationId,
              ),
            ].slice(0, 20),
          });
        });
      writes = operation;
      return operation;
    },
    clearHistory() {
      // Reset through the same queue; earlier opens can never repopulate a cleared history.
      const epoch = identityEpoch;
      const operation = writes
        .catch(() => {})
        .then(() => {
          if (stopped || !preferences.history.state().ready || identityEpoch !== epoch) return;
          return preferences.history.set(emptyHistory);
        });
      writes = operation;
      return operation;
    },
  };
  return service;
});

declare module '@bitakit/core' {
  interface ServiceMap {
    'quick-search.search': ReturnType<typeof searchService.create>;
  }
}
