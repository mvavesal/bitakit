import Icon from 'reicon-react/icons/Settings';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'Nav.settings',
  href: '/settings',
  icon: Icon,
  groups: ['navigation.main', 'account.preferences'],
  order: 40,
});
