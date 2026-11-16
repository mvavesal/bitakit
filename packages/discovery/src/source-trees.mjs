/**
 * Syntax trees of discovered entries, keyed by the entry object `discoverEntries` returns, so
 * `describeDefinitions` does not read and parse a file the walk already parsed.
 */
export const sourceTrees = new WeakMap();
