import {
  defineSlot,
  definePlugin,
  discoveredFile,
  type DiscoveredSlotEntry,
  type PublicSlotsOf,
  type SlotPayload,
  type SlotData,
  type ScopedSlots,
} from '../src/core.js';

const footer = defineSlot({
  accepts: 'component',
  payload: { parse: (_value: unknown) => ({ collapsed: true as boolean }) },
});
const data = defineSlot({
  accepts: 'data',
  schema: {
    '~standard': {
      types: undefined as unknown as { input: unknown; output: { count: number } },
      validate: (_input: unknown) => ({ value: { count: 1 } }),
    },
  },
  policy: 'keyed',
});
const plugin = definePlugin({
  id: 'shell',
  slots: {
    sidebar: { footer },
    totals: data,
    brand: defineSlot({ id: 'logo', accepts: 'component', policy: 'single' }),
  },
});
type Manual = PublicSlotsOf<readonly [typeof plugin]>;
const file = discoveredFile({ sidebar: { footer } }, '', 'slots/index.ts');
type Discovered = DiscoveredSlotEntry<typeof file, 'shell'>;
declare module '../src/presentation.js' {
  interface SlotMap extends Manual {}
}
const payload: SlotPayload<'shell.sidebar.footer'> = { collapsed: false };
const same: SlotPayload<Discovered['shell.sidebar.footer']> = payload;
const totals: SlotData<'shell.totals'> = { count: 1 };
const direct: SlotPayload<typeof footer> = same;
const single: Manual['logo']['policy'] = 'single';
// @ts-expect-error Explicit IDs do not create an additional inferred ID.
type Missing = Manual['shell.brand'];
// @ts-expect-error Payload is inferred from the schema.
const invalid: SlotPayload<'shell.sidebar.footer'> = { collapsed: 'yes' };
// @ts-expect-error Data slots require a schema.
defineSlot({ accepts: 'data' });
// @ts-expect-error Components do not declare a data schema.
defineSlot({ accepts: 'component', schema: { parse: () => 1 } });
// @ts-expect-error Only explicit policies are supported.
defineSlot({ accepts: 'actions', policy: 'replace' });
const array = definePlugin({
  id: 'array',
  slots: [defineSlot({ id: 'absolute', accepts: 'actions' })],
});
type ArraySlots = PublicSlotsOf<readonly [typeof array]>;
const action: ArraySlots['absolute']['accepts'] = 'actions';
void [payload, same, totals, direct, single, invalid, action];

const empty = definePlugin({ id: 'empty', slots: {} });
const emptyArray = definePlugin({ id: 'empty-array', slots: [] });
const emptyFile = discoveredFile({}, '', 'slots/index.ts');
interface EmptyManual extends PublicSlotsOf<readonly [typeof empty, typeof emptyArray]> {}
interface EmptyDiscovered extends DiscoveredSlotEntry<typeof emptyFile, 'empty'> {}

declare const slots: ScopedSlots;
slots.attach({ slot: 'shell.totals', key: 'count', data: { count: 1 } });
slots.attach({ slot: 'shell.sidebar.footer', component: () => null }, { availability: 'wait' });
// @ts-expect-error Keyed slots require an explicit key.
slots.attach({ slot: 'shell.totals', data: { count: 1 } });
// @ts-expect-error The data contract comes from SlotMap.
slots.attach({ slot: 'shell.totals', key: 'count', data: { count: '1' } });
// @ts-expect-error Data cannot be contributed to a component slot.
slots.attach({ slot: 'shell.sidebar.footer', data: {} });
// @ts-expect-error A contribution has exactly one content kind.
slots.attach({ slot: 'shell.sidebar.footer', component: () => null, data: {} });
const mixed = { slot: 'shell.sidebar.footer' as const, component: () => null, data: {} };
// @ts-expect-error Kind exclusivity also applies to variables, not only literals.
slots.attach(mixed);
// @ts-expect-error Availability does not invent lifecycle modes.
slots.attach({ slot: 'shell.sidebar.footer', component: () => null }, { availability: 'ignore' });
