import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Print this page',
  groups: ['playground.more'],
  execute: () => window.print(),
});
