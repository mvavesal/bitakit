import { defineAction } from '@bitakit/core';
import TrashIcon from 'reicon-react/icons/Trash';

export default defineAction<number>({
  title: 'Delete',
  icon: TrashIcon,
  confirm: {
    title: 'Delete this deal?',
    description: 'It leaves the pipeline and every widget that shows it.',
    destructive: true,
  },
  concurrency: 'per-input',
  execute: ({ services, input }) => services.pipeline.deals.remove(input),
  success: 'Deal deleted',
});
