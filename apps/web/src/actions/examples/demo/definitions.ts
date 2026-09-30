import type { ActionDefinition, ActionList } from '@bitakit/ui/actions';
import SaveIcon from 'reicon-react/icons/Floppy';
import EyeIcon from 'reicon-react/icons/Eye';
export const SAVE = 'demo.save';
export const PREVIEW = 'demo.preview';
export type DemoDependencies = {
  list: ActionList;
  setError: (message: string) => void;
  setMessage: (message: string) => void;
  setCompleted: (update: (value: number) => number) => void;
};
export function demoActions({ list, setError, setMessage, setCompleted }: DemoDependencies) {
  const definition: ActionDefinition = {
    id: SAVE,
    title: 'Save draft',
    description: 'A local demonstration. No data is sent to a server.',
    icon: SaveIcon,
    async execute() {
      setError('');
      setMessage('Saving draft…');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setCompleted((value) => value + 1);
      setMessage('Draft saved locally for this demonstration.');
    },
  };
  const previewDefinition: ActionDefinition = {
    id: PREVIEW,
    title: 'Preview mode',
    icon: EyeIcon,
    checked: false,
    execute({ update }) {
      update({ checked: !list.get(PREVIEW)?.checked });
    },
  };
  return [definition, previewDefinition];
}
