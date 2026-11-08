# Roles and permissions

Plugins declare what can be done; the app decides which roles may do it. Core only checks the
declarations; the authorization provider (Better Auth through `@bitakit/better-auth`) owns
membership, custom roles and every server-side decision.

## Declare a plugin's permissions

```ts
// src/plugins/content/permissions.ts
import { definePermissions } from '@bitakit/core';

export default definePermissions({ content: ['read', 'edit', 'publish'] });
```

- Resources and operations start with a lowercase letter (letters, digits, `-`).
- One resource has one owning plugin. Another plugin uses it, it never declares it again.
- A plugin never declares roles; a `roles.ts` in a plugin fails discovery.

## Define the app's base roles

```ts
// src/roles.ts
import { defineRoles } from '@bitakit/core';

export default defineRoles(
  {
    owner: { standard: 'owner', grants: { content: ['read', 'edit', 'publish'] } },
    admin: { standard: 'admin', grants: { content: ['read', 'edit', 'publish'] } },
    member: { standard: 'member', label: 'Editor', grants: { content: ['read', 'edit'] } },
    viewer: { label: 'Reader', description: 'Can view content.', grants: { content: ['read'] } },
  },
  { customRoles: true },
);
```

- `standard` extends the provider's built-in `owner`, `admin` or `member` (each once).
- `label`/`description` are defaults; translations (`roles.<id>.label|description`) override.
- `grants` are typed against the discovered permissions after `npx bitakit generate`.
- Order is display order only; it never ranks permissions.
- `customRoles: true` lets organizations create their own roles through the provider.

## Checks

`npx bitakit generate` (part of typecheck) and the runtime start reject, with every source file
named: a resource declared twice, a grant of an unknown resource or operation, a standard role
extended twice, and roles outside `src/roles.ts`. Fix the declaration; never rely on order.

## Rules

- Check capabilities on the server through the provider ("may this member publish content in
  this organization?"), never role names or order. Client checks only shape the UI.
- Do not keep role lists, aliases or rank tables in the app; read the declared roles.
