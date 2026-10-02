/**
 * File templates for plugins and their contributions. Each function returns a map of
 * module-relative paths to file contents; callers decide where the module root is
 * (`src/plugins/<name>` in an app, `src` in a standalone plugin package).
 */

/** Plugin and contribution names: lowercase, starting with a letter, words joined by hyphens. */
export const namePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function validateName(name, what = 'name') {
  if (!namePattern.test(name ?? ''))
    throw new Error(
      `Invalid ${what} "${name ?? ''}". Use lowercase letters and digits, optionally joined by hyphens (for example "notes" or "user-notes").`,
    );
  return name;
}

const words = (name) => name.split('-');
/** `user-notes` → `User notes` */
export const titleOf = (name) => {
  const text = words(name).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** `user-notes` → `UserNotes` */
export const pascalOf = (name) =>
  words(name)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
/** Property access for a service name: `.notes` or `['user-notes']`. */
const member = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`);

/**
 * A complete feature: a service that owns the data, actions that change it, a navigation link
 * and a page. `minimal` keeps only the service and one action.
 */
export function pluginFiles(name, { minimal = false } = {}) {
  validateName(name, 'plugin name');
  const title = titleOf(name);
  const service = member(name);
  const files = {
    [`services/${name}.ts`]: `import { defineService } from '@bitakit/core';

export type Item = { id: number; title: string };

/**
 * The ${title} plugin's data and behavior. Items live in memory, so a page reload starts
 * empty. Replace the body with calls to your API or database when you are ready.
 */
export default defineService({
  create({ events }) {
    let items: Item[] = [];
    let nextId = 1;
    // Tell actions and pages that the list changed.
    const changed = () => events.emit('${name}.changed');
    return {
      list: () => items,
      add(title: string) {
        items = [...items, { id: nextId++, title: title.trim() }];
        changed();
      },
      remove(id: number) {
        items = items.filter((item) => item.id !== id);
        changed();
      },
    };
  },
});
`,
    'actions/add.ts': `import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add item',
  // Buttons bound to this action are disabled while the input is empty.
  resolve: (input) => ({ enabled: typeof input === 'string' && input.trim().length > 0 }),
  // Runs when a bound button or your code executes "${name}.add".
  execute: ({ services, input }) => services${service}.add(input),
});
`,
  };
  if (minimal) return files;
  return {
    ...files,
    'actions/remove.ts': `import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Remove',
  execute: ({ services, input }) => services${service}.remove(input),
});
`,
    'actions/clear.ts': `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear all',
  // Nothing to clear at first; onEvent keeps this up to date.
  enabled: false,
  // Runs every time the service emits "${name}.changed". BitaKit owns the subscription.
  events: ['${name}.changed'],
  onEvent(_event, { services, action }) {
    action.enabled = services${service}.list().length > 0;
  },
  execute({ services }) {
    for (const item of services${service}.list()) services${service}.remove(item.id);
  },
});
`,
    'actions/open.ts': `import { defineURLAction } from '@bitakit/core';

// Adds "${title}" to the app navigation. The page lives in pages/${name}.tsx.
export default defineURLAction({ title: '${title}', href: '/${name}', groups: ['navigation'] });
`,
    [`pages/${name}.tsx`]: pageFile(name, `/${name}`, title, { list: true }),
  };
}

export function pageFile(plugin, path, title, { list = false } = {}) {
  const component = `${pascalOf(path.split('/').filter(Boolean).join('-') || plugin)}Page`;
  if (!list)
    return `'use client';
import { definePage } from '@bitakit/core';
import { PageHeader } from '@bitakit/ui/components';

function ${component}() {
  return <PageHeader title="${title}" subtitle="Edit this page in the ${plugin} plugin." />;
}

export default definePage({ path: '${path}', component: ${component} });
`;
  const service = member(plugin);
  return `'use client';
import { useState } from 'react';
import { definePage } from '@bitakit/core';
import { ActionButton, useFoundationApp, useWatchEvent } from '@bitakit/ui';
import { Button, Input, PageHeader } from '@bitakit/ui/components';

function ${component}() {
  const app = useFoundationApp();
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(() => app.optional.services${service}?.list() ?? []);
  // Re-read the list whenever the service announces a change.
  useWatchEvent('${plugin}.changed', () => {
    setItems(app.services${service}.list());
    setTitle('');
  });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="${title}" subtitle="Add and remove items. Everything here lives in the ${plugin} plugin." />
      <div className="flex gap-2">
        <Input
          value={title}
          placeholder="New item"
          aria-label="New item"
          onChange={(event) => setTitle(event.target.value)}
        />
        <ActionButton action="${plugin}.add" input={title} as={Button} />
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{item.title}</span>
            <ActionButton action="${plugin}.remove" input={item.id} as={Button} variant="ghost" size="sm" />
          </li>
        ))}
      </ul>
      <ActionButton action="${plugin}.clear" as={Button} variant="outline" className="self-start" />
    </div>
  );
}

export default definePage({ path: '${path}', component: ${component} });
`;
}

export function actionFile(name) {
  validateName(name, 'action name');
  return `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: '${titleOf(name)}',
  // This plugin's services need no declaration. List services from other plugins in
  // requires, for example requires: ['billing.invoices'].
  execute: ({ services }) => {
    // Call your services here, for example services.notes.add('…').
  },
});
`;
}

export function serviceFile(name) {
  validateName(name, 'service name');
  return `import { defineService } from '@bitakit/core';

/** Other contributions call these methods as services${member(name)}. */
export default defineService({
  create() {
    return {
      ping: () => 'pong',
    };
  },
});
`;
}
