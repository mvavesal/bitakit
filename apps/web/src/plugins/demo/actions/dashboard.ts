import Icon from 'reicon-react/icons/Flask';
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Nav.plugins',
  href: '/dashboard#demo-plugin',
  icon: Icon,
  groups: ['navigation.main'],
  order: 35,
});
