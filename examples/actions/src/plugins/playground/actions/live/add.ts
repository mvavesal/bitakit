import { defineAction } from '@bitakit/core';
import { capacity } from '../../services/live';

export default defineAction({
  title: 'Add action',
  enabled: ({ services }) => services.playground.live.state.get().actions.length < capacity,
  execute: ({ services }) => services.playground.live.add(),
});
