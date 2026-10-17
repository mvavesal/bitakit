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
/** Property access for a plugin namespace: `.notes` or `['user-notes']`. */
const member = (name) =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`;

/**
 * The smallest working feature: one page, plus its navigation link when the app has a navigation
 * slot. More files are added one at a time with `bitakit add <kind>`.
 */
export function starterFiles(name, { navigationSlot } = {}) {
  validateName(name, 'plugin name');
  const title = titleOf(name);
  const component = `${pascalOf(name)}Page`;
  return {
    ...(navigationSlot
      ? {
          'actions/open.ts': `import { defineAction } from '@bitakit/core';

// The menu entry for this feature; the page lives in ui/pages/index.tsx.
export default defineAction({ title: '${title}', href: '/${name}', groups: ['navigation'], slots: [${JSON.stringify(navigationSlot)}] });
`,
        }
      : {}),
    'ui/pages/index.tsx': `'use client';
import { PageHeader } from '@bitakit/ui/components';

// Served at /${name}; the file's place under ui/pages is the URL.
// Grow the feature one file at a time:
//   shared state -> npx bitakit add service ${name}/items
//   a button     -> npx bitakit add action ${name}/archive (bind it with <Action id="${name}.archive">)
export default function ${component}() {
  return <PageHeader title="${title}" subtitle="Edit this page in src/plugins/${name}/ui/pages/index.tsx." />;
}
`,
  };
}

/**
 * A complete feature: a service that owns the data, typed events, actions that change it, a
 * navigation link and a page. `minimal` keeps only the service, the events and one action.
 */
export function pluginFiles(name, { minimal = false, navigationSlot } = {}) {
  validateName(name, 'plugin name');
  const title = titleOf(name);
  const items = `services${member(name)}.items`;
  const files = {
    'services/items.ts': `import { defineService } from '@bitakit/core';

export type Item = { id: number; title: string };

/**
 * The ${title} plugin's data and behavior. Items live in memory, so a page reload starts
 * empty. Replace the body with calls to your API or database when you are ready.
 */
export default defineService(({ store, events }) => {
  // Observable state: actions and pages follow it without any wiring.
  // Resources belong in onStart/onStop; Core awaits cleanup before replacement.
  const state = store<{ items: Item[] }>({ items: [] });
  return {
    state,
    add(title: string) {
      state.set((s) => ({ items: [...s.items, { id: Date.now(), title: title.trim() }] }));
      events.emit('${name}.changed', { kind: 'added' });
    },
    remove(id: number) {
      state.set((s) => ({ items: s.items.filter((item) => item.id !== id) }));
      events.emit('${name}.changed', { kind: 'removed' });
    },
  };
});
`,
    'events.ts': `import { defineEvents, event } from '@bitakit/core';

// Other plugins listen with events.on('${name}.changed', ...). Only this plugin emits it.
export default defineEvents({
  changed: event<{ kind: 'added' | 'removed' }>(),
});
`,
    'actions/add.ts': `import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add item',
  // Buttons bound to this action are disabled while their input is empty.
  enabled: ({ input }) => typeof input === 'string' && input.trim().length > 0,
  // Runs when a bound button or your code executes "${name}.add".
  execute: ({ services, input }) => ${items}.add(input),
});
`,
  };
  if (minimal) return files;
  return {
    ...files,
    'actions/remove.ts': `import { defineAction } from '@bitakit/core';

export default defineAction<number>({
  title: 'Remove',
  // Each row tracks its own pending state.
  concurrency: 'per-input',
  execute: ({ services, input }) => ${items}.remove(input),
});
`,
    'actions/clear.ts': `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear all',
  // Re-evaluated whenever the items store changes.
  enabled: ({ services }) => ${items}.state.get().items.length > 0,
  confirm: 'Remove all items?',
  execute: ({ services }) => {
    for (const item of ${items}.state.get().items) ${items}.remove(item.id);
  },
  success: 'All items removed',
});
`,
    'actions/open.ts': `import { defineAction } from '@bitakit/core';

// The page lives in ui/pages/index.tsx. Placement is explicit; groups are logical queries.
export default defineAction({ title: '${title}', href: '/${name}', groups: ['navigation']${navigationSlot ? `, slots: [${JSON.stringify(navigationSlot)}]` : ''} });
`,
    'ui/pages/index.tsx': pageFile(name, `/${name}`, title, { list: true }),
  };
}

export function pageFile(plugin, path, title, { list = false } = {}) {
  const component = `${pascalOf(path.split('/').filter(Boolean).join('-') || plugin)}Page`;
  if (!list)
    return `'use client';
import { PageHeader } from '@bitakit/ui/components';

// Served at ${path}; the path comes from this file's location under ui/pages.
export default function ${component}() {
  return <PageHeader title="${title}" subtitle="Edit this page in the ${plugin} plugin." />;
}
`;
  return `'use client';
import { useState } from 'react';
import { Action, useServiceState } from '@bitakit/ui';
import { Button, Input, PageHeader } from '@bitakit/ui/components';

// Served at ${path}; the path comes from this file's location under ui/pages.
export default function ${component}() {
  // Re-renders whenever the service's store changes.
  const items = useServiceState('${plugin}.items', (state) => state.items, []);
  const [title, setTitle] = useState('');
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
        <Action id="${plugin}.add" input={title} onExecuted={() => setTitle('')}>
          <Button />
        </Action>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{item.title}</span>
            <Action id="${plugin}.remove" input={item.id}>
              <Button variant="ghost" size="sm" />
            </Action>
          </li>
        ))}
      </ul>
      <Action id="${plugin}.clear">
        <Button variant="outline" className="self-start" />
      </Action>
    </div>
  );
}
`;
}

export function actionFile(name) {
  const segments = name.split('/');
  segments.forEach((segment) => validateName(segment, 'action name'));
  return `import { defineAction } from '@bitakit/core';

export default defineAction({
  title: '${titleOf(segments.at(-1))}',
  // Services are services.<plugin>.<name>; reading an unknown one fails with a named error.
  execute: ({ services }) => {
    // Call your services here, for example services.notes.items.add('…').
  },
});
`;
}

/** Retains the generated fields and store; navigation and body placement are automatic. */
export function settingsPageFile() {
  return `'use client';
import type { ReactNode } from 'react';
import type { SettingsCatalogSection, SettingsCatalogField } from '@bitakit/app-preferences';

// Requires @bitakit/app-preferences. Add custom content alongside the canonical fields.
// No Action, navigation entry or slot registration is needed for this page.
export default function SettingsPage({ section, renderField }: {
  section: SettingsCatalogSection;
  renderField: (field: SettingsCatalogField) => ReactNode;
}) {
  return <>{section.fields.map(renderField)}</>;
}
`;
}

export function serviceFile(name, plugin = '<plugin>') {
  const segments = name.split('/');
  segments.forEach((segment) => validateName(segment, 'service name'));
  const id = `${plugin}.${segments.join('.')}`;
  return `import { defineService } from '@bitakit/core';

/**
 * Shared state and logic: services.${id} in services and Actions,
 * useServiceState('${id}', (state) => state.count, 0) in React.
 * Async work goes in onStart, cleanup in onStop.
 */
export default defineService(({ store }) => {
  const state = store({ count: 0 });
  return {
    state,
    increment: () => state.set((s) => ({ count: s.count + 1 })),
  };
});
`;
}

export function eventsFile(plugin) {
  return `import { defineEvents, event } from '@bitakit/core';

// Names are prefixed with the plugin ID: emit and listen as '${plugin}.<name>'.
export default defineEvents({
  changed: event<{ id: number }>(),
});
`;
}

export function settingsFile(plugin) {
  return `import { defineSettings, setting } from '@bitakit/core';

// Saved preferences of this feature. Read them as settings.${plugin}.<name>.get() in services and
// Actions, or useSetting('${plugin}.<name>').value in React. Each gets a field on /settings/${plugin}.
export default defineSettings({
  pageSize: setting({ default: 20, control: 'number', label: 'Items per page' }),
});
`;
}

export function layoutFile(name) {
  const component = `${pascalOf(name)}Layout`;
  return `import type { ReactNode } from 'react';

// Pages choose this layout with: export const layout = '${name}';
export default function ${component}({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>;
}
`;
}

export function slotFile(plugin, slot) {
  const component = `${pascalOf(slot.replace(/\./g, '-'))}Slot`;
  return `'use client';

// A widget for the "${slot}" extension point; its owner renders it with <PluginSlot name="${slot}" />.
// It appears once both plugins are ready. Optional: export const order = 1 to sort widgets.
export default function ${component}() {
  return <span className="text-sm text-muted-foreground">${plugin}</span>;
}

`;
}

/** An extension point this plugin owns; `slotFile` contributes a widget to one. */
export function slotDefinitionFile(id = '<plugin>.<name>') {
  return `import { defineSlot } from '@bitakit/core';

// An extension point other plugins can fill. Render it where it belongs: <PluginSlot name="${id}" />.
// Another plugin adds a widget with: npx bitakit add slot <their-plugin>/${id}
export default defineSlot({ accepts: 'component', policy: 'list' });
`;
}

export function dialogFile(plugin, name) {
  const component = `${pascalOf(name)}Dialog`;
  return `'use client';
import { Button } from '@bitakit/ui/components';

// Opened by an action with dialog: ${component}; the host decides the frame (dialog, sheet, drawer).
export default function ${component}({ close }: { input?: unknown; close: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Content of ${plugin}.${name}.</p>
      <Button type="button" onClick={close}>
        Done
      </Button>
    </div>
  );
}
`;
}

export function providerFile(plugin, name) {
  const component = `${pascalOf(name)}Provider`;
  return `'use client';
import type { ReactNode } from 'react';

// Wrapped around the app by BitaKitProvider; export const requires = ['other-plugin.provider'] to order providers.
export default function ${component}({ children }: { children: ReactNode }) {
  return children;
}
`;
}

export function interceptorFile(plugin, name) {
  return `import { defineInterceptor } from '@bitakit/core';

// Observes every action of this plugin; use action: '${plugin}.<name>' for one of them.
export default defineInterceptor({
  action: '${plugin}.*',
  before: ({ id, input }) => {
    console.debug('[${plugin}] ${name}', id, input);
  },
});
`;
}

export function configFile(name) {
  return `import { defineConfig } from '@bitakit/core';

// Read as config.plugin.get('${name}.enabled', true) in contributions, or app.config.<plugin>.${name}.
export default defineConfig({
  defaults: { enabled: true },
});
`;
}
