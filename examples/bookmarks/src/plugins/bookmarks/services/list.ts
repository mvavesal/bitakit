import { defineService } from '@bitakit/core';
/** One saved link, as the API route returns it. */
export type Bookmark = { id: number; title: string; url: string };

type State = { bookmarks: Bookmark[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message, so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

// The browser's copy of the bookmarks in SQLite, loaded through src/app/api/bookmarks/route.ts.
export default defineService(({ store, onStart }) => {
  const state = store<State>({ bookmarks: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    state.set((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const response = await send('/api/bookmarks', { signal });
      const { bookmarks } = (await response.json()) as { bookmarks: Bookmark[] };
      state.set({ bookmarks, status: 'ready', error: '' });
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  // Startup does not wait for the network; the page shows `status` while the list loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  return {
    state,
    reload: () => load(),
    async add(url: string) {
      const response = await send('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const { bookmark } = (await response.json()) as { bookmark: Bookmark };
      // Change the store only after the server confirmed the change.
      state.set((current) => ({ ...current, bookmarks: [bookmark, ...current.bookmarks] }));
    },
    async remove(id: number) {
      await send(`/api/bookmarks?id=${id}`, { method: 'DELETE' });
      state.set((current) => ({
        ...current,
        bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== id),
      }));
    },
  };
});
