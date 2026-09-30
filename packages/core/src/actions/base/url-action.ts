import { Action, type ActionOptions } from '../action.js';
import { safeHref } from '../navigation.js';
export type URLActionOptions = ActionOptions<void> & { href: string };

export class URLAction extends Action<void> {
  constructor(url: string | URLActionOptions, options: ActionOptions<void> = { title: '' }) {
    const resolved = typeof url === 'string' ? { ...options, href: url } : url;
    if (!safeHref(resolved.href)) throw new Error('Invalid navigation target.');
    super({ ...resolved, value: undefined });
  }
  execute() {
    if (!this.href) throw new Error('A URL is required.');
    this.navigate(this.href);
  }
}
