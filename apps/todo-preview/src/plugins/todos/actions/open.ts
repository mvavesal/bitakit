import { defineAction } from '@bitakit/core';

// Adds "Todos" to the app navigation. The page lives in ui/pages/index.tsx.
export default defineAction({ title: 'Todos', href: '/todos', groups: ['navigation'] });
