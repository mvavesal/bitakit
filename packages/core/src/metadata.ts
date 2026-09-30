import type { PluginMetadata } from './definitions.js';

/** Copy public package fields only; never bundle scripts, config or arbitrary manifest data. */
export function pluginMetadata(source: PluginMetadata): PluginMetadata {
  const { name, version, description, author, homepage, bugs, license } = source;
  return {
    ...(name === undefined ? {} : { name }),
    ...(version === undefined ? {} : { version }),
    ...(description === undefined ? {} : { description }),
    ...(author === undefined ? {} : { author }),
    ...(homepage === undefined ? {} : { homepage }),
    ...(bugs === undefined ? {} : { bugs }),
    ...(license === undefined ? {} : { license }),
  };
}
