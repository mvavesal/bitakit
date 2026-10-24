/** Where the settings route lives unless a host passes another `basePath`. */
export const defaultBasePath = '/settings';

/** The path without query, hash and trailing slashes, for comparing locations. */
export function normalizePath(href: string): string {
  return (href.split(/[?#]/)[0] ?? '').replace(/\/+$/, '') || '/';
}

/** `/settings` + `{ path: 'todos' }` → `/settings/todos`. */
export function sectionHref(basePath: string, section: { readonly path: string }): string {
  const base = normalizePath(basePath);
  return `${base === '/' ? '' : base}/${section.path}`;
}

/** The anchor of one setting on its page, `setting-<key>`: the field's id, for links to it. */
export function settingAnchor(key: string): string {
  return `setting-${key}`;
}

/** `/settings` + `{ path: 'shell' }` + `shell.theme` → `/settings/shell#setting-shell.theme`. */
export function settingHref(
  basePath: string,
  section: { readonly path: string },
  key: string,
): string {
  return `${sectionHref(basePath, section)}#${settingAnchor(key)}`;
}

export function isBasePath(pathname: string, basePath: string): boolean {
  return normalizePath(pathname) === normalizePath(basePath);
}

/** Keeps the settings search when moving between settings pages. */
export function withQuery(href: string, query: string): string {
  return query.trim() ? `${href}?${new URLSearchParams({ q: query })}` : href;
}
