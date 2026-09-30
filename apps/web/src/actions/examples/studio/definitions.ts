import type { ActionList } from '@bitakit/ui/actions';
import ArrowDownToLineIcon from 'reicon-react/icons/Download';
import EyeIcon from 'reicon-react/icons/Eye';
import SaveIcon from 'reicon-react/icons/Floppy';
import { SAVE, PREVIEW, DOWNLOAD, STORAGE_KEY, LESSONS, validDraft, type Draft } from './model';

export type StudioDependencies = {
  list: ActionList;
  getDraft: () => Draft;
  setSaved: (draft: Draft) => void;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
};
export function studioActions({
  list,
  getDraft,
  setSaved,
  setError,
  setMessage,
}: StudioDependencies) {
  const saveDefinition = {
    id: SAVE,
    title: 'Save draft',
    icon: SaveIcon,
    enabled: false,
    execute() {
      const snapshot = { ...getDraft() };
      if (!validDraft(snapshot))
        throw new Error('Add a course title and learning goal before saving.');
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        throw new Error(
          'This browser could not save your draft. Download a copy to keep your changes.',
        );
      }
      setSaved(snapshot);
      setError('');
      setMessage('Draft saved in this browser.');
    },
  };
  const previewDefinition = {
    id: PREVIEW,
    title: 'Preview',
    icon: EyeIcon,
    checked: false,
    execute() {
      const checked = !list.get(PREVIEW)?.checked;
      list.update(PREVIEW, {
        checked,
        title: checked ? 'Back to editing' : 'Preview',
      });
    },
  };
  const downloadDefinition = {
    id: DOWNLOAD,
    title: 'Download JSON',
    icon: ArrowDownToLineIcon,
    enabled: false,
    execute() {
      if (!validDraft(getDraft()))
        throw new Error('Add a course title and learning goal before downloading.');
      const document = {
        schemaVersion: 1,
        id: 'sample-onboarding',
        ...getDraft(),
        lessons: LESSONS,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = window.document.createElement('a');
      link.href = url;
      link.download = 'course-draft.json';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
      setMessage('JSON download started. It includes your latest edits.');
    },
  };
  return [saveDefinition, previewDefinition, downloadDefinition];
}
