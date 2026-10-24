import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Export as Markdown',
  // Placed in the toolbar the notes plugin declares and renders.
  slots: ['notes.toolbar'],
  // notes.list belongs to another plugin; listing it turns a missing service into a startup error.
  requires: ['notes.list'],
  enabled: ({ services }) => services.notes.list.state.get().notes.length > 0,
  execute: ({ services }) => {
    const notes = services.notes.list.state.get().notes;
    const text = notes.map((note) => `- ${note.title}`).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    link.download = 'notes.md';
    link.click();
    URL.revokeObjectURL(link.href);
    return notes.length;
  },
  success: ({ result }) => `Exported ${result} notes`,
});
