import { z } from 'zod';
import type { PluginMetadata } from './definitions.js';

// Optional descriptive shapes only. Loading policy, npm identity, URLs, licensing and
// compatibility have their own owners; metadata does not invent additional admission rules.
const fields = {
  name: z.string(),
  title: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.union([
    z.string(),
    z.object({ name: z.string(), email: z.string().optional(), url: z.string().optional() }),
  ]),
  homepage: z.string(),
  bugs: z.union([
    z.string(),
    z.object({ url: z.string().optional(), email: z.string().optional() }),
  ]),
  license: z.string(),
  coverImage: z.string(),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  repository: z.union([
    z.string(),
    z.object({ type: z.string().optional(), url: z.string(), directory: z.string().optional() }),
  ]),
};
export type PluginMetadataSources = Readonly<{
  canonical?: PluginMetadata;
  legacy?: PluginMetadata;
}>;

/** One pure projection for build, discovery and runtime. Invalid optional values fall back per
 * field; executable icons and arbitrary package fields never enter the serializable result. */
export function projectPluginMetadata(canonical: unknown = {}, ...legacy: unknown[]) {
  return projectPluginMetadataSources([
    { value: canonical, location: 'canonical metadata' },
    ...legacy.map((value) => ({ value, location: 'legacy metadata' })),
  ]);
}

/** Projects ordered sources with truthful diagnostic labels. The first valid field wins. */
export function projectPluginMetadataSources(
  sources: readonly { value: unknown; location: string }[],
) {
  const metadata: PluginMetadata = {};
  const warnings: string[] = [];
  const owners = new Map<keyof typeof fields, number>();
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    for (const [index, { value: source, location }] of sources.entries()) {
      if (!source || typeof source !== 'object') continue;
      const value = (source as Record<string, unknown>)[key];
      if (value === undefined) continue;
      const parsed = fields[key].safeParse(value);
      if (!parsed.success) {
        warnings.push(
          `Invalid optional metadata.${key} in ${location}; using the next available source.`,
        );
        continue;
      }
      const owner = owners.get(key);
      if (owner === undefined) {
        Object.assign(metadata, { [key]: parsed.data });
        owners.set(key, index);
      } else if (JSON.stringify(metadata[key]) !== JSON.stringify(parsed.data)) {
        warnings.push(
          `Conflicting metadata.${key}: ${sources[owner].location} takes precedence over ${location}.`,
        );
      }
    }
  }
  const titleOwner = owners.get('title');
  const nameOwner = owners.get('name');
  if (
    titleOwner !== undefined &&
    nameOwner !== undefined &&
    titleOwner < nameOwner &&
    metadata.title !== metadata.name
  )
    warnings.push(
      `Conflicting display title: metadata.title in ${sources[titleOwner].location} takes precedence over metadata.name in ${sources[nameOwner].location}.`,
    );
  return { metadata, warnings: [...new Set(warnings)] };
}

/** Standard npm data plus the existing bitakit block; npm name stays package identity. */
export function packageMetadataSources(source: Record<string, unknown>): PluginMetadataSources {
  const block = source.bitakit ?? source.foundation;
  const bitakit = block && typeof block === 'object' ? (block as Record<string, unknown>) : {};
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (key === 'name') continue;
    const value = ['title', 'tags', 'coverImage'].includes(key) ? bitakit[key] : source[key];
    if (value !== undefined) canonical[key] = value;
  }
  return {
    canonical,
    legacy: { tags: source.tags, coverImage: source.coverImage } as PluginMetadata,
  };
}

/** Compatibility helper: copies supported public fields, without arbitrary manifest data. */
export function pluginMetadata(source: PluginMetadata): PluginMetadata {
  return projectPluginMetadata(source).metadata;
}
