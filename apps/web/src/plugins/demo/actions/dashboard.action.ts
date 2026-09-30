import Icon from 'reicon-react/icons/Flask';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'Nav.plugins',
  href: '/dashboard#demo-plugin',
  icon: Icon,
  groups: ['navigation.main'],
  order: 35,
});
