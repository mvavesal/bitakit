import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, defineAction, definePlugin } from '@bitakit/core';
import { destinationSources } from '../dist/destination-sources.js';

test('page search uses canonical plugin titles and preserves host translations', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({
        id: 'notes',
        metadata: { title: 'Notes', name: '@acme/notes' },
        actions: { page: defineAction({ title: 'Open notes', href: '/notes' }) },
      }),
    ],
  });
  const stop = runtime.mount();
  await runtime.ready;
  try {
    const pages = destinationSources().find((s) => s.id === 'pages').source;
    const context = {
      runtime,
      actions: runtime.actions,
      query: '',
      score: () => 1,
      groupTitle: (g) => g.title ?? g.id,
      text: (value) => value.fallback,
    };
    const results = pages.search(context);
    assert.equal(results[0].detail, 'Page · Notes');
    const translated = pages.search({
      ...context,
      text: (value) => (value.key === 'plugins.notes.name' ? 'Notizen' : value.fallback),
    });
    assert.equal(translated[0].detail, 'Page · Notizen');
  } finally {
    await stop();
  }
});
