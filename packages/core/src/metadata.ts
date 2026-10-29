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
  const metadata: PluginMetadata = {};
  const warnings: string[] = [];
  const read = (source: unknown, key: keyof typeof fields, location: string) => {
    if (!source || typeof source !== 'object') return undefined;
    const value = (source as Record<string, unknown>)[key];
    if (value === undefined) return undefined;
    const parsed = fields[key].safeParse(value);
    if (parsed.success) return parsed.data;
    warnings.push(
      `Invalid optional metadata.${key} in ${location}; using the next available source.`,
    );
    return undefined;
  };
  for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
    const primary = read(canonical, key, 'canonical metadata');
    const fallback = legacy
      .map((source) => read(source, key, 'legacy metadata'))
      .find((value) => value !== undefined);
    if (
      primary !== undefined &&
      fallback !== undefined &&
      JSON.stringify(primary) !== JSON.stringify(fallback)
    )
      warnings.push(
        `Conflicting metadata.${key}: canonical metadata takes precedence over legacy metadata.`,
      );
    const value = primary ?? fallback;
    if (value !== undefined) Object.assign(metadata, { [key]: value });
  }
  const legacyName = legacy
    .map((source) => read(source, 'name', 'legacy metadata'))
    .find((value) => value !== undefined);
  if (metadata.title !== undefined && legacyName !== undefined && metadata.title !== legacyName)
    warnings.push(
      'Conflicting display title: package.json bitakit.title takes precedence over legacy metadata.name.',
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
