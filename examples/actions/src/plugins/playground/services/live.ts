import { defineService } from '@bitakit/core';
import type { LiveConfig } from '../live-action';

/** As many live Actions as there are Alt+number shortcuts we hand out. */
export const capacity = 5;

const create = (number: number): LiveConfig => ({
  number,
  places: ['toolbar'],
  title: `Action ${number}`,
  tooltip: '',
  icon: (['star', 'heart', 'rocket', 'bell'] as const)[(number - 1) % 4],
  enabled: true,
  visible: true,
  confirm: false,
  slow: false,
  message: '',
});

// The configurations of the live Actions, one to start with. ui/providers/live.tsx turns each
// into an Action; the Actions in actions/live/ add, change and remove them.
export default defineService(({ store }) => {
  const state = store({ configs: [create(1)] });
  return {
    state,
    add: () =>
      state.set((current) => {
        const used = current.configs.map((config) => config.number);
        const number = [1, 2, 3, 4, 5].find((candidate) => !used.includes(candidate));
        return number ? { configs: [...current.configs, create(number)] } : current;
      }),
    remove: (number: number) =>
      state.set((current) => ({
        configs: current.configs.filter((config) => config.number !== number),
      })),
    /** Changes some settings of Action `number`. */
    set: ({ number, ...change }: Partial<LiveConfig> & { number: number }) =>
      state.set((current) => ({
        configs: current.configs.map((config) =>
          config.number === number ? { ...config, ...change } : config,
        ),
      })),
  };
});
