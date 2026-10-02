// Node module hooks for the provider test: Next ships extensionless subpaths such as
// `next/navigation` for bundlers, so plain Node ESM needs the `.js` added to load them.
export async function resolve(specifier, context, nextResolve) {
  if (/^next\/[a-z-]+$/.test(specifier)) return nextResolve(`${specifier}.js`, context);
  return nextResolve(specifier, context);
}
