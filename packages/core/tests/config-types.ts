import {
  defineAction,
  defineService,
  discoveredFile,
  type DiscoveredActionEntry,
  type DiscoveredServiceEntry,
  type DiscoveredConfigEntry,
  ConfigScope,
  ConfigService,
  type ConfigAt,
} from '../src/core.js';
const actions = discoveredFile(
  { refresh: defineAction({ execute: ({ input }: { input: { id: string } }) => input.id.length }) },
  '',
  'actions.ts',
);
type Actions = DiscoveredActionEntry<typeof actions, 'content'>;
const input: Actions['content.refresh']['input'] = { id: 'one' };
const result: Actions['content.refresh']['result'] = 1;
// @ts-expect-error Result is numeric.
const invalid: Actions['content.refresh']['result'] = 'no';
const service = discoveredFile(
  defineService({ create: ({ config }) => ({ size: config.plugin.get('size', 10) }) }),
  'logging',
  'services.logging.ts',
);
type Service = DiscoveredServiceEntry<typeof service, 'content'>;
const instance: Service['content.logging'] = { size: 10 };
const values = discoveredFile({ pageSize: 50 }, 'actions.refresh', 'configs.actions.refresh.ts');
type Config = DiscoveredConfigEntry<typeof values>;
const scope = new ConfigScope<Config>({ actions: { refresh: { pageSize: 5 } } });
const pageSize: number = scope.get('actions.refresh.pageSize');
// @ts-expect-error The declared page size is numeric.
const wrongSize: string = scope.get('actions.refresh.pageSize');
declare module '../src/config-service.js' {
  interface ConfigMap {
    example: Config;
  }
}
const configuration = new ConfigService([{ id: 'example' }]);
const inferred: number = configuration.plugin('example').get('actions.refresh.pageSize');
void [input, result, invalid, instance, pageSize, wrongSize, inferred];
