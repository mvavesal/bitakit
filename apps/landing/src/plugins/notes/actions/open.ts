import { defineAction } from '@bitakit/core';
import BookOpenIcon from 'reicon-react/icons/BookOpen';

export default defineAction({
  title: 'Notes',
  icon: BookOpenIcon,
  href: '/notes',
  slots: ['features'],
});
