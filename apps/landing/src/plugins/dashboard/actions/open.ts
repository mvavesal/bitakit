import { defineAction } from '@bitakit/core';
import HomeIcon from 'reicon-react/icons/Home';

export default defineAction({
  title: 'Dashboard',
  icon: HomeIcon,
  href: '/dashboard',
  slots: [{ slot: 'shell.navigation', order: -20 }],
});
