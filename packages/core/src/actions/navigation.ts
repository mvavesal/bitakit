import type { ActionContext } from './core.js';
import { brand, isBrandedInstance } from './brand.js';

type Navigation = (href: string) => void;

/** A per-list adapter. Bind once at the application boundary, not per action. */
export class NavigationHost {
  static {
    brand(this, 'navigation');
  }
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

/** Navigates to `href`, or to the registration's current href; the registration must still exist. */
export function navigate(context: ActionContext, href?: string) {
  const current = context.get();
  const target = current ? safeHref(href ?? current.href) : undefined;
  if (!target) throw new Error('Invalid navigation target.');
  if (!isBrandedInstance(context.environment, NavigationHost, 'navigation'))
    throw new Error('A NavigationHost is required.');
  // This dispatches navigation. Completion does NOT mean the next route has loaded.
  (context.environment as NavigationHost).go(target);
}
