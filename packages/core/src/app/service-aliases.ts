import type { Plugin } from '../definitions.js';
import { serviceKey } from '../service-key.js';
import { FoundationStartupError } from '../startup-error.js';
import type { PublicServiceKeys } from './types.js';

/** Resolves names onto existing container keys; this does not create or store service instances. */
export function serviceAliases(
  module: Pick<Plugin, 'id' | 'services' | 'publicServices'>,
): PublicServiceKeys {
  const aliases: Record<string, ReturnType<typeof serviceKey<any>>> = Object.assign(
    Object.create(null),
    module.publicServices,
  );
  for (const service of module.services ?? []) {
    if (service.exposeAs === undefined) continue;
    const name = service.exposeAs;
    if (Object.hasOwn(aliases, name) && aliases[name] !== service.id)
      throw new FoundationStartupError(
        `Plugin "${module.id}" exposes two services named "${name}". Rename one of the service files, or set exposeAs on one of them.`,
        module.id,
      );
    aliases[name] = serviceKey(service.id);
  }
  return aliases;
}
