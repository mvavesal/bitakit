import { defineBitaKit } from '@bitakit/discovery';

// Two files offer the frame of normal pages (the part `layout.app`): the app's own
// src/layouts/app.tsx and the classic plugin's ui/layouts/app.tsx. The app's own file wins.
// To show the plugin's frame instead, choose it and reload:
//   choose: { 'layout.app': 'classic' },
export default defineBitaKit({});
