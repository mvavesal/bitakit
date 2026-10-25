import { defineAction } from '@bitakit/core';
import UsersIcon from 'reicon-react/icons/Users';

export default defineAction({
  title: 'Contacts',
  icon: UsersIcon,
  href: '/contacts',
  slots: ['features'],
});
