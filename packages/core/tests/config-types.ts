import { z } from 'zod';
import {
  ConfigScope,
  ConfigService,
  defineAction,
  defineConfig,
  defineService,
  discoveredFile,
  type ConfigAt,
  type DiscoveredActionEntry,
  type DiscoveredConfigEntry,
  type DiscoveredServiceEntry,
} from '../src/core.js';

// Actions type their input explicitly or through a schema; the result is inferred from execute.
const explicit = defineAction<{ id: string }>({ execute: ({ input }) => input.id.length });
const schema = { parse: (input: unknown) => String(input) };
const inferred = defineAction({ input: schema, execute: ({ input }) => input.length });
const zodInferred = defineAction({
  input: z.object({ title: z.string() }),
  execute: ({ input }) => input.title,
});
// @ts-expect-error The handler input is the schema output, not an arbitrary type.
defineAction({ input: z.string(), execute: ({ input }: { input: number }) => input });
const actions = discoveredFile(
  { refresh: explicit, add: inferred, create: zodInferred },
  '',
  'actions.ts',
);
type Actions = DiscoveredActionEntry<typeof actions, 'content'>;
const input: Actions['content.refresh']['input'] = { id: 'one' };
const result: Actions['content.refresh']['result'] = 1;
const added: Actions['content.add']['input'] = 'text';
const created: Actions['content.create']['input'] = { title: 'x' };
const createdResult: Actions['content.create']['result'] = 'x';
// With an explicit input type the result is unknown by design; a schema lets execute infer it.
const untyped: Actions['content.refresh']['result'] = 'anything';
// @ts-expect-error Result is numeric.
const invalid: Actions['content.add']['result'] = 'no';

// Services read their plugin config through the factory context.
const service = discoveredFile(
  defineService(({ config }) => ({
    size: config.plugin.get('size', 10),
    label: config.action.get('label', 'none'),
  })),
  'logging',
  'services/logging.ts',
);
type Service = DiscoveredServiceEntry<typeof service, 'content'>;
const instance: Service['content.logging'] = { size: 10, label: 'none' };

// Config files export defineConfig({ defaults }), defineConfig({ schema }) or both.
const values = discoveredFile(
  defineConfig({ defaults: { pageSize: 50 } }),
  'actions.refresh',
  'configs/actions/refresh.ts',
);
type Config = DiscoveredConfigEntry<typeof values>;
const scope = new ConfigScope<Config>({ actions: { refresh: { pageSize: 5 } } });
const pageSize: number = scope.get('actions.refresh.pageSize');
// @ts-expect-error The declared page size is numeric.
const wrongSize: string = scope.get('actions.refresh.pageSize');
const limits = defineConfig({
  schema: z.object({ maxItems: z.number() }),
  defaults: { maxItems: 100 },
});
type Limits = DiscoveredConfigEntry<typeof discoveredFile<typeof limits, 'limits'>>;
const maxItems: ConfigAt<Limits, 'limits.maxItems'> = 3;
// @ts-expect-error Defaults must match the schema output.
defineConfig({ schema: z.object({ maxItems: z.number() }), defaults: { maxItems: 'many' } });
// @ts-expect-error Plain objects are no longer wrapped by defineConfig.
defineConfig({ pageSize: 50 });

declare module '../src/config-service.js' {
  interface ConfigMap {
    example: Config;
  }
}
const configuration = new ConfigService([{ id: 'example' }]);
const typed: number = configuration.plugin('example').get('actions.refresh.pageSize');
void [
  input,
  result,
  added,
  created,
  createdResult,
  untyped,
  invalid,
  instance,
  pageSize,
  wrongSize,
  maxItems,
  typed,
];
