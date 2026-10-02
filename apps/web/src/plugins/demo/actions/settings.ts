import { defineAction } from '@bitakit/core';
import Icon from 'reicon-react/icons/Flask';

export default defineAction({
  href: '/settings/demo',
  groups: ['account.preferences'],
  icon: Icon,
  order: 50,
});
