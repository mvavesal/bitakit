import { defineAction } from '@bitakit/core';
import EyeIcon from 'reicon-react/icons/Eye';

export default defineAction({
  icon: EyeIcon,
  title: ({ services }) =>
    services.studio.draft.state.get().preview ? 'Back to editing' : 'Preview',
  checked: ({ services }) => services.studio.draft.state.get().preview,
  execute: ({ services }) => services.studio.draft.togglePreview(),
  success: false,
});
