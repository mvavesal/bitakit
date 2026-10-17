import { contributionSource, preserveContributionPath } from '../contribution-origin.js';
import { discoveredFile, discoverSlots } from '../discovered.js';
import type { Plugin } from '../definitions.js';
import { BitaKitStartupError } from '../startup-error.js';
import type { OwnedSlotDefinition } from './define.js';

/** Composition and Discovery converge here; there is no mutable declaration registry. */
export function normalizeSlots(module: Plugin, appId: string): readonly OwnedSlotDefinition[] {
  const source = `slots of ${module.id}`;
  const files = Array.isArray(module.slots)
    ? module.slots.map((slot, index) => {
        if (!slot.id)
          throw new BitaKitStartupError(
            'A slot in an array needs an id. Prefer a named record.',
            module.id,
            { app: module.id === appId },
          );
        return discoveredFile(slot, String(index), contributionSource(slot) ?? source);
      })
    : [discoveredFile(module.slots ?? {}, '', source)];
  try {
    return Object.freeze(
      discoverSlots(files, module.id === appId ? '' : module.id).map(
        (slot) =>
          preserveContributionPath(
            slot,
            Object.freeze({ ...slot, plugin: module.id }),
          ) as OwnedSlotDefinition,
      ),
    );
  } catch (error) {
    if (error instanceof BitaKitStartupError)
      throw new BitaKitStartupError(error.message, module.id, {
        cause: error,
        source: error.source,
        app: module.id === appId,
      });
    throw error;
  }
}

export function validateSlotDeclarations(
  modules: readonly { slots: readonly OwnedSlotDefinition[] }[],
  appId: string,
) {
  const seen = new Map<string, OwnedSlotDefinition>();
  for (const module of modules)
    for (const slot of module.slots) {
      const previous = seen.get(slot.id);
      if (previous)
        throw new BitaKitStartupError(
          `Duplicate slot "${slot.id}": ${contributionSource(previous) ?? previous.plugin} and ${contributionSource(slot) ?? slot.plugin}.`,
          slot.plugin,
          { source: contributionSource(slot), app: slot.plugin === appId },
        );
      seen.set(slot.id, slot);
    }
}
