import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Sign in page',
  href: '/account/login',
  slots: ['shell.navigation'],
});
