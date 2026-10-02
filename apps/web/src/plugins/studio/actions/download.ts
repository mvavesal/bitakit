import { defineAction } from '@bitakit/core';
import DownloadIcon from 'reicon-react/icons/Download';

export default defineAction({
  title: 'Download JSON',
  icon: DownloadIcon,
  enabled: ({ services }) => services.studio.draft.canDownload(),
  execute: ({ services }) => {
    services.studio.draft.download();
  },
  success: false,
});
