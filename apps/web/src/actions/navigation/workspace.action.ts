import Icon from 'reicon-react/icons/Layers';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'Nav.workspace',
  href: '/app-preview',
  icon: Icon,
  groups: ['navigation.main'],
  order: 0,
});
