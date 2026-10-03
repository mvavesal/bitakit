import type { MountedPlugin } from '../testing/index.js';

// The generated maps of an app augment ActionMap the same way; the handle never imports them.
declare module '@bitakit/core' {
  interface ActionMap {
    'notes.add': { input: string; result: number };
  }
}

async function check(mounted: MountedPlugin) {
  const outcome = await mounted.execute('notes.add', 'Write tests');
  if (outcome.status === 'completed') {
    const value: number = outcome.value;
    void value;
  }
  // @ts-expect-error Known IDs type their input.
  await mounted.execute('notes.add', 42);
  // Short names relative to the mounted plugin and unknown IDs stay untyped.
  await mounted.execute('add', 42);
  // The runtime's ActionList is typed by the same IDs.
  await mounted.actions.execute('notes.add', 'x');
  // @ts-expect-error Known IDs type their input on the ActionList as well.
  await mounted.runtime.actions.execute('notes.add', 1);
}
void check;
