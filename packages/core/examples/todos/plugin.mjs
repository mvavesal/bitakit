import { definePlugin } from '@bitakit/core';
import tasks from './services/tasks.mjs';
import create from './actions/create.mjs';
import list from './actions/list.mjs';
import remove from './actions/delete.mjs';

export default definePlugin({
  id: 'todos',
  services: [tasks],
  actions: [create, list, remove],
});
