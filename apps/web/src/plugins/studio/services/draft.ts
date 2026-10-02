import { defineService } from '@bitakit/core';
import { INITIAL, LESSONS, STORAGE_KEY, validDraft, type Draft } from '../model';

export type StudioState = {
  draft: Draft;
  saved: Draft | null;
  /** True once the saved draft was read from this browser. */
  ready: boolean;
  preview: boolean;
  message: string;
  error: string;
};

/**
 * The course draft of the public studio. Saved only in this browser; the store drives the
 * save, preview and download actions and the studio page.
 */
export default defineService(({ store, onStart }) => {
  const state = store<StudioState>({
    draft: INITIAL,
    saved: null,
    ready: false,
    preview: false,
    message: 'Your sample draft is ready to edit.',
    error: '',
  });
  const update = (patch: Partial<StudioState>) =>
    state.set((current) => ({ ...current, ...patch }));
  const service = {
    state,
    valid: () => validDraft(state.get().draft),
    dirty: () => {
      const { draft, saved } = state.get();
      return !saved || draft.title !== saved.title || draft.objective !== saved.objective;
    },
    canSave: () => state.get().ready && service.valid() && service.dirty(),
    canDownload: () => state.get().ready && service.valid(),
    edit(field: keyof Draft, value: string) {
      update({
        draft: { ...state.get().draft, [field]: value },
        message: 'You have unsaved changes.',
      });
    },
    /** Reads the draft saved in this browser; an unreadable draft keeps the sample editable. */
    restore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!validDraft(parsed)) throw new Error('Invalid saved draft');
          const restored = { title: parsed.title, objective: parsed.objective };
          update({
            draft: restored,
            saved: restored,
            message: 'Saved draft restored from this browser.',
          });
        }
        update({ ready: true, error: '' });
      } catch {
        update({
          ready: true,
          error:
            'The saved sample could not be loaded. You can edit this example and download a copy.',
        });
      }
    },
    /** Saves in this browser; a blocked storage keeps the draft and explains the alternative. */
    save() {
      const snapshot = { ...state.get().draft };
      if (!validDraft(snapshot)) {
        update({ error: 'Add a course title and learning goal before saving.' });
        return false;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        update({
          error: 'This browser could not save your draft. Download a copy to keep your changes.',
        });
        return false;
      }
      update({ saved: snapshot, error: '', message: 'Draft saved in this browser.' });
      return true;
    },
    togglePreview() {
      update({ preview: !state.get().preview });
    },
    /** Downloads the draft with the sample lessons as JSON. */
    download() {
      const draft = state.get().draft;
      if (!validDraft(draft)) {
        update({ error: 'Add a course title and learning goal before downloading.' });
        return false;
      }
      const document = { schemaVersion: 1, id: 'sample-onboarding', ...draft, lessons: LESSONS };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
      );
      const link = window.document.createElement('a');
      link.href = url;
      link.download = 'course-draft.json';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      update({ error: '', message: 'JSON download started. It includes your latest edits.' });
      return true;
    },
  };
  onStart(() => {
    if (typeof localStorage !== 'undefined') service.restore();
  });
  return service;
});
