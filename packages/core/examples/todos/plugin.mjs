import { definePlugin } from '@bitakit/core';
import list from './services/list.mjs';
import events from './events.mjs';
import create from './actions/create.mjs';
import all from './actions/all.mjs';
import remove from './actions/delete.mjs';

export default definePlugin({
  id: 'todos',
  events,
  services: { list },
  actions: { create, all, delete: remove },
});
