import Icon from 'reicon-react/icons/Settings';
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Nav.settings',
  href: '/settings',
  icon: Icon,
  groups: ['navigation.main', 'account.preferences'],
  order: 40,
});
