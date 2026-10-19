export const introductionGroups = ['Build a feature', 'Extend the UI', 'Connect behavior'] as const;

export const introductionSteps = [
  {
    group: 'Build a feature',
    first: 'feature',
    summary: 'Create a plugin, then give it a page and Actions.',
    description:
      'First name your plugin and describe its purpose. Then add its page, Actions and settings. The plugin can live inside your app or in a standalone package.',
  },
  {
    group: 'Extend the UI',
    first: 'slot',
    summary: 'Make room for UI from other plugins.',
    description:
      'Give your page an extension point: define a slot, place its outlet, then let another plugin add a widget. Or target an existing menu slot.',
  },
  {
    group: 'Connect behavior',
    first: 'event',
    summary: 'Connect plugins through events and interceptors.',
    description:
      'Let one plugin announce an event and another listen. Add an interceptor when you want to observe Actions without editing each handler.',
  },
] as const;

// Authored examples for the introductory preview, not a plugin registry or execution engine.
export const introductionExamples = [
  {
    key: 'feature',
    group: 'Build a feature',
    label: 'Create a plugin',
    result: 'The Notes plugin is defined. It has an identity and a purpose; its page comes next.',
    explanation: (
      <>
        {' '}
        This optional <code>plugin.config.ts</code> explicitly names the feature. Discovery collects
        the Actions, pages and settings you add beside it. In-app: <code>src/plugins/notes/</code>.
        Standalone package: its own <code>src/</code>, with the CLI providing package/build setup.
        Without this config file, the app folder already supplies the plugin ID.{' '}
      </>
    ),
    file: 'src/plugins/notes/plugin.config.ts',
    code: `import { definePlugin } from '@bitakit/core';

export default definePlugin({
  id: 'notes',
  metadata: {
    name: 'Notes',
    description: 'Capture and organize workspace notes.',
  },
});`,
    href: '/docs/concepts/discovery#pluginconfigts-and-bitakitconfigts',
    more: 'Plugin configuration and packages',
  },
  {
    key: 'page',
    group: 'Build a feature',
    label: 'Add a page',
    result: 'The Notes plugin now has a page at /notes.',
    explanation: (
      <>
        {' '}
        Put this page inside the Notes plugin. Discovery derives the route from{' '}
        <code>ui/pages/index.tsx</code>. This adds a screen to the plugin you just defined; it does
        not create a second plugin.{' '}
      </>
    ),
    file: 'src/plugins/notes/ui/pages/index.tsx',
    code: `export default function NotesPage() {
  return <section>
    <h1>Notes</h1>
    <p>Your ideas, in one place.</p>
  </section>;
}`,
    href: '/docs/concepts/plugins',
    more: 'Plugin pages',
  },
  {
    key: 'service',
    group: 'Build a feature',
    label: 'Add note state',
    result: 'The Notes service can create notes and keeps them in memory.',
    explanation: (
      <>
        {' '}
        <strong>A service owns the data.</strong> The next toolbar Action calls <code>add</code>; it
        does not keep a second store. These notes last until the runtime is replaced or the page
        reloads.{' '}
      </>
    ),
    file: 'src/plugins/notes/services/notebook.ts',
    code: `import { defineService } from '@bitakit/core';

export default defineService(({ store }) => {
  const state = store({ notes: [] as { id: string; title: string }[] });
  return {
    state,
    add() {
      const note = { id: crypto.randomUUID(), title: 'Untitled note' };
      state.set(s => ({ notes: [...s.notes, note] }));
      return note;
    },
  };
});`,
    href: '/docs/concepts/services',
    more: 'Services and shared state',
  },
  {
    key: 'navigation',
    group: 'Build a feature',
    label: 'Add a navigation Action',
    result: 'Notes now appears in navigation.',
    explanation: (
      <>
        {' '}
        A URL Action targets the existing <code>shell.navigation</code> slot. Shell renders the
        link; the Notes page keeps its own route.{' '}
      </>
    ),
    slot: 'shell.navigation',
    accepts: 'actions',
    file: 'src/plugins/notes/actions/open.ts',
    code: `import { defineAction } from '@bitakit/core';
import Note from 'reicon-react/icons/Note';

export default defineAction({
  id: 'notes.open', // Optional: inferred from this file's path.
  title: 'Notes',
  description: 'Open your notes workspace.',
  icon: Note,
  href: '/notes',
  slots: ['shell.navigation'],
});`,
    href: '/docs/concepts/actions#choose-where-an-action-appears',
    more: 'Action placement',
  },
  {
    key: 'toolbar',
    group: 'Build a feature',
    label: 'Add a toolbar Action',
    result: 'Add note now appears in the header toolbar.',
    explanation: (
      <>
        {' '}
        Shell renders the Action in the trailing header toolbar. The <code>slots</code> property
        selects its placement; <code>execute</code> calls the notebook service to create a note.
        Logging belongs in the later interceptor example.{' '}
      </>
    ),
    slot: 'shell.toolbar',
    accepts: 'actions',
    file: 'src/plugins/notes/actions/add.ts',
    code: `import { defineAction } from '@bitakit/core';
import Plus from 'reicon-react/icons/Plus';

export default defineAction({
  id: 'notes.add', // Optional: inferred from this file's path.
  title: 'Add note',
  description: 'Create a note in your workspace.',
  icon: Plus,
  slots: ['shell.toolbar'],
  execute: ({ services }) => services.notes.notebook.add(),
});`,
    href: '/docs/concepts/actions',
    more: 'Actions and bindings',
  },
  {
    key: 'settings',
    group: 'Build a feature',
    label: 'Add a Settings page',
    result:
      'One declaration adds Notes to the Settings navigation and generates its page and fields.',
    explanation: (
      <>
        {' '}
        App Preferences derives the page and navigation from <code>settings.ts</code>.{' '}
        <strong>Core owns the saved values.</strong> No separate page or navigation registration is
        needed. These illustrated controls show the defaults; they do not edit settings here.{' '}
      </>
    ),
    file: 'src/plugins/notes/settings.ts',
    code: `import { defineSettings, setting } from '@bitakit/core';

export default defineSettings({
  autoSave: setting({ default: true, label: 'Auto-save' }),
  pageSize: setting({ default: 10, label: 'Notes per page' }),
  maxLength: setting({ default: 2000, label: 'Maximum note length' }),
}, { title: 'Notes' });`,
    href: '/docs/concepts/settings',
    more: 'Settings pages',
  },
  {
    key: 'slot',
    group: 'Extend the UI',
    label: 'Define your own slot',
    result: 'Notes declares a component slot. Choose Place the slot to make its outlet visible.',
    explanation: (
      <>
        {' '}
        <code>notes.footer</code> is the public name other plugins target. The <code>id</code> is
        optional: <code>slots/footer.ts</code> inside the notes plugin produces the same name
        automatically. This slot accepts React content; Place the slot chooses where it
        renders.{' '}
      </>
    ),
    slot: 'notes.footer',
    accepts: 'component',
    file: 'src/plugins/notes/slots/footer.ts',
    code: `import { defineSlot } from '@bitakit/core';

// Other plugins can add helpful content below the Notes page.
export default defineSlot({
  id: 'notes.footer', // Optional: inferred from this file's path.
  accepts: 'component',
});`,
    href: '/docs/concepts/slots#4-use-a-different-slot-for-custom-ui',
    more: 'Your own extension points',
  },
  {
    key: 'outlet',
    group: 'Extend the UI',
    label: 'Place the slot',
    result: 'An empty footer outlet now appears below the Notes heading.',
    explanation: (
      <>
        {' '}
        Create the Notes page or replace its earlier version with this one. <code>
          PluginSlot
        </code>{' '}
        uses the same <code>notes.footer</code> ID to position contributed content. This also works
        in a panel or menu you own. The dashed frame is only part of this illustration.{' '}
      </>
    ),
    slot: 'notes.footer',
    accepts: 'component',
    file: 'src/plugins/notes/ui/pages/index.tsx',
    code: `'use client';
import { PluginSlot } from '@bitakit/ui';

export default function NotesPage() {
  return <section>
    <h1>Notes</h1>
    <p>Your ideas, in one place.</p>
    <PluginSlot name="notes.footer" />
  </section>;
}`,
    href: '/docs/concepts/slots#4-use-a-different-slot-for-custom-ui',
    more: 'Your own extension points',
  },
  {
    key: 'widget',
    group: 'Extend the UI',
    label: 'Add another plugin’s widget',
    result: 'The Tips plugin contributes content inside Notes, without changing the page.',
    explanation: (
      <>
        {' '}
        The filename targets <code>notes.footer</code>. Define and render that slot first; then an
        installed plugin can contribute its own React content.{' '}
      </>
    ),
    slot: 'notes.footer',
    accepts: 'component',
    file: 'src/plugins/tips/ui/slots/notes.footer.tsx',
    code: `export default function NoteTip() {
  return <p>Keep each note focused on one idea.</p>;
}`,
    href: '/docs/concepts/slots',
    more: 'Slots',
  },
  {
    key: 'member',
    group: 'Extend the UI',
    label: 'Add a member-menu item',
    result: 'Copy member ID is added to the member menu. Open the menu to see it.',
    explanation: (
      <>
        {' '}
        The Organizations UI supplies the selected member ID. Your Action joins its declared menu
        slot without changing the member list. In the real app, a click copies the ID using the
        browser clipboard; this illustration only shows its source.{' '}
      </>
    ),
    slot: 'organizations.member.menu',
    accepts: 'actions',
    file: 'src/plugins/audit/actions/copy-member-id.ts',
    code: `import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  id: 'audit.copy-member-id', // Optional: inferred from this file's path.
  title: 'Copy member ID',
  description: 'Copy this member’s ID to the clipboard.',
  slots: [{
    slot: 'organizations.member.menu',
    input: ({ payload }) => payload.memberId,
  }],
  execute: ({ input }) => navigator.clipboard.writeText(input),
});`,
    href: '/docs/reference/slots#bind-each-occurrence',
    more: 'Contextual menu slots',
  },
  {
    key: 'event',
    group: 'Connect behavior',
    label: 'Declare an event',
    result: 'The Notes plugin declares notes.changed with the ID of the affected note.',
    explanation: (
      <>
        {' '}
        <strong>An event announces a completed change.</strong> Its small payload tells other
        plugins which note changed, without giving them ownership of the notebook store.{' '}
      </>
    ),
    file: 'src/plugins/notes/events.ts',
    code: `import { defineEvents, event } from '@bitakit/core';

export default defineEvents({ changed: event<{ noteId: string }>() });`,
    href: '/docs/concepts/events#1-declare-one-event',
    more: 'Declaring events',
  },
  {
    key: 'emit',
    group: 'Connect behavior',
    label: 'Emit the event',
    result: 'Add note now creates the note, then announces notes.changed.',
    explanation: (
      <>
        {' '}
        Replace the earlier <code>add.ts</code> with this version. The same toolbar Action first
        calls its service, then emits the changed note ID. This is one Action registration; the new
        behavior extends it. The preview shows the code without executing it.{' '}
      </>
    ),
    file: 'src/plugins/notes/actions/add.ts',
    code: `import { defineAction } from '@bitakit/core';
import Plus from 'reicon-react/icons/Plus';

export default defineAction({
  id: 'notes.add', // Optional: inferred from this file's path.
  title: 'Add note',
  description: 'Create a note in your workspace.',
  icon: Plus,
  slots: ['shell.toolbar'],
  execute: ({ services, events }) => {
    const note = services.notes.notebook.add();
    events.emit('notes.changed', { noteId: note.id });
    return note;
  },
});`,
    href: '/docs/concepts/events#2-emit-after-the-change',
    more: 'Emitting events',
  },
  {
    key: 'events',
    group: 'Connect behavior',
    label: 'Connect an event listener',
    result: 'Activity remembers the last changed note, independently of the Notes implementation.',
    explanation: (
      <>
        {' '}
        An independent service stores the last observed note ID for an Activity view. This is event
        history, not a second notebook store; earlier events are not replayed. The runtime releases
        its subscription with the service.{' '}
      </>
    ),
    file: 'src/plugins/activity/services/feed.ts',
    code: `import { defineService } from '@bitakit/core';

export default defineService(({ events, store }) => {
  const state = store({ lastChangedNoteId: null as string | null });
  events.on('notes.changed', ({ data }) => {
    state.set({ lastChangedNoteId: data.noteId });
  });
  return { state };
});`,
    href: '/docs/concepts/events',
    more: 'Events',
  },
  {
    key: 'interceptor',
    group: 'Connect behavior',
    label: 'Add Action logging',
    result: 'An interceptor observes completed notes.* Actions.',
    explanation: (
      <>
        {' '}
        <strong>One app-level interceptor</strong> observes matching Actions. Its <code>after</code>{' '}
        hook logs the result without changing it. Action guards and service observation are
        explained in the detailed guide.{' '}
      </>
    ),
    file: 'src/interceptors/log-notes.ts',
    code: `import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  action: 'notes.*',
  after: ({ id }) => console.log('Completed:', id),
});`,
    href: '/docs/concepts/interceptors',
    more: 'Interceptors',
  },
] as const;

export type IntroductionKey = (typeof introductionExamples)[number]['key'];
