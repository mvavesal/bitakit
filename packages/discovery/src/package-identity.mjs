/** Predicts the historical build ID; never use this to identify an installed plugin. */
export function packagePluginId(name = '') {
  return (
    name
      .replace(/^@[^/]+\//, '')
      .replace(/^bitakit-(plugin-)?/, '')
      .replace(/-plugin$/, '')
      .replace(/[^a-z0-9-]/g, '-') || 'plugin'
  );
}

/** Both static authorities must agree. Old sidecars simply have no binding evidence. */
export function staticPluginId(name, metadata, sidecar) {
  const manifestId = metadata.id;
  const sidecarId = sidecar?.version === 1 ? sidecar.pluginId : undefined;
  for (const [source, id] of [
    ['manifest', manifestId],
    ['sidecar', sidecarId],
  ])
    if (id !== undefined && (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)))
      throw new Error(`Invalid static plugin ID in the ${source} of package "${name}".`);
  if (manifestId !== undefined && sidecarId !== undefined && manifestId !== sidecarId)
    throw new Error(
      `Package "${name}" has contradictory static plugin IDs: manifest "${manifestId}", sidecar "${sidecarId}". Rebuild the package with a matching ID.`,
    );
  return manifestId ?? sidecarId ?? null;
}

/** Static activation conflicts retain both owners; inspection can still list every record. */
export function pluginIdentityConflicts(records) {
  const owners = new Map();
  const conflicts = [];
  for (const { id, source } of records) {
    if (!id) continue;
    if (owners.has(id))
      conflicts.push(
        `Plugin ID "${id}" conflicts between ${owners.get(id)} and ${source}. Activate only one definition with this ID.`,
      );
    else owners.set(id, source);
  }
  return conflicts;
}
