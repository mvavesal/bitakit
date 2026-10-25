import { defineAction } from '@bitakit/core';
import ClipboardListIcon from 'reicon-react/icons/ClipboardList';

export default defineAction({
  title: 'Tasks',
  icon: ClipboardListIcon,
  href: '/tasks',
  slots: ['features'],
});
