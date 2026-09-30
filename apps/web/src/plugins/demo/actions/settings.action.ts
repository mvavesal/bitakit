import { defineURLAction } from '@bitakit/core';
import Icon from 'reicon-react/icons/Flask';

export default defineURLAction({
  href: '/settings/demo',
  groups: ['account.preferences'],
  icon: Icon,
  order: 50,
});
