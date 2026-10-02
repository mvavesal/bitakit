# @bitakit/devtools

A live inspector for one plugin of a running BitaKit app: its pages, its actions (run them with JSON input), its services, the events it emits and its resolved configuration. New in 0.2; meant for playgrounds and development builds.

```sh
npm install @bitakit/devtools
```

Render it on any page inside the BitaKit provider:

```tsx
'use client';

import { Inspector } from '@bitakit/devtools';

export default function Page() {
  return <Inspector plugin="notes" />;
}
```

Install it as a regular dependency: discovery then adds its styles to the generated `.foundation/styles.css`. In a host without discovery, import `@bitakit/devtools/styles.css` yourself. The inspector reads the existing runtime and keeps no copy of plugin state. Plugin packages created with `npx @bitakit/create-app my-plugin --plugin` show it in their playground.
