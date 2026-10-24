import { defineAction } from '@bitakit/core';

// A navigation entry: Shell shows it in the sidebar, Quick Search (Mod+K) finds it.
export default defineAction({ title: 'Todos', href: '/todos', slots: ['shell.navigation'] });
