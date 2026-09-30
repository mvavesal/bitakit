import type { ActionContext } from './core.js';

type Navigation = (href: string) => void;

/** A per-list adapter. Bind once at the application boundary, not per action. */
export class NavigationHost {
  private navigate?: Navigation;
  bind(navigate: Navigation) {
    this.navigate = navigate;
    return () => {
      if (this.navigate === navigate) this.navigate = undefined;
    };
  }
  go(href: string) {
    if (!this.navigate) throw new Error('Navigation is not mounted.');
    this.navigate(href);
  }
}

/** Only root-relative paths, hashes and explicit http(s) URLs are supported. */
export function safeHref(href: string | undefined): string | undefined {
  if (!href || /[\u0000-\u0020\u007f\\]/.test(href)) return undefined;
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return href;
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? href
      : undefined;
  } catch {
    return undefined;
  }
}

export function navigate(context: ActionContext) {
  const current = context.get();
  const href = safeHref(current?.href);
  if (!href) throw new Error('Invalid navigation target.');
  if (!(context.environment instanceof NavigationHost))
    throw new Error('A NavigationHost is required.');
  // This dispatches navigation. Completion does NOT mean the next route has loaded.
  context.environment.go(href);
}
