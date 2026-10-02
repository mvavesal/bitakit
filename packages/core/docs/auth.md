# Client authentication

Available since Core 0.1.1 with `@bitakit/ui`, `@bitakit/shell` and `@bitakit/better-auth` 0.1.0.
Core owns the `AuthService` contract. Optional provider plugins supply the session;
`@bitakit/ui` observes it and uses the existing framework navigation binding.
There is no second session store. Server authentication and authorization remain
with the provider and application server.

## Better Auth and external paths

```ts
import { betterAuthPlugin } from '@bitakit/better-auth';

const authPlugin = betterAuthPlugin(client, {
  paths: {
    signIn: '/account/login',
    afterSignIn: '/customers',
    afterSignOut: '/',
  },
});
// Add authPlugin to the existing FoundationProvider plugin list.
```

Paths are application-owned, safe root-relative URLs. No routes are created.
`useAuth().signIn({ returnTo })` navigates to the configured login page with a
`returnTo` query parameter, unless the adapter supplies a native `signIn` handler.
External or login-loop return destinations fall back to `afterSignIn`.

The login page must pass `resolveAuthReturnTo(paths, returnToFromURL)` to the native
provider login API as its completion destination. `afterSignIn` is a fallback,
not an automatic session-change redirect. Providers requiring absolute callbacks
should resolve the validated path against the configured **application** origin,
not the authentication-server origin. Keep secrets and server configuration on the server.

```tsx
import { AuthBoundary, useAuth } from '@bitakit/ui';
import { LoadingPage, ErrorPage } from '@bitakit/shell/pages';

function ProtectedContent({ children }) {
  return (
    <AuthBoundary pending={<LoadingPage />} renderError={() => <ErrorPage />}>
      {children}
    </AuthBoundary>
  );
}

function AccountControls() {
  const { user, pending, signOut } = useAuth();
  // Bind signOut to the application's existing Action or button handler.
  // Handle a rejected promise using the application's existing error presentation.
}
```

`AuthBoundary` waits for pending session resolution and does not redirect on session
errors. `redirect={false}` allows host-owned unauthenticated presentation. It is a
client rendering convenience, never a security boundary. Keep native server checks.
`useAuth().signOut()` awaits the adapter and then navigates to `afterSignOut`;
the boundary does not race that operation with a login redirect. A subsequent
protected route can start login normally. Calling a native SDK or service directly
does not invoke this UI navigation policy. Configure only one owner for logout navigation.

## Writing another adapter

Implement the existing `AuthService` and register it as a service that `provides` the
`authService` contract, in an ordinary plugin. No Core change, provider registry or host
bootstrap is needed. The following is an adapter template: `source` is a normalized SDK
bridge that the adapter author implements using their provider's public APIs, not an
Auth.js or Clerk API.

```ts
import {
  authService,
  configureAuthPaths,
  definePlugin,
  defineService,
  type AuthPaths,
  type AuthService,
} from '@bitakit/core';

export function customAuthPlugin(source: AuthService, paths: AuthPaths) {
  return definePlugin({
    id: 'custom-auth',
    services: {
      // Reached as services['custom-auth'].session and, through the contract, services.auth.
      session: defineService(
        (): AuthService => ({
          paths: configureAuthPaths(paths),
          getSnapshot: () => source.getSnapshot(),
          subscribe: (listener) => source.subscribe(listener),
          signOut: () => source.signOut(),
          ...(source.signIn ? { signIn: (options) => source.signIn!(options) } : {}),
        }),
        { provides: authService },
      ),
    },
  });
}
```

Inside a plugin folder the same service is `services/session.ts` with the options as the
second argument; discovery derives the ID.

The bridge must return a stable `{ user, pending, error }` snapshot until it changes;
`user` contains at least `id`, and `null` means signed out only once `pending` is false
and `error` is absent. Subscribe to native SDK updates and return an unsubscribe
function. Preserve SDK failures, await sign-out, and release any adapter-owned
resources through the ordinary service/plugin lifecycle. Keep React-only SDK providers
inside the optional integration package using existing plugin providers.

Auth.js and Clerk adapters are not implemented here. Their native session/login APIs
must be mapped inside their optional packages; organizations, registration and password
recovery are not standardized by this small contract. The `@bitakit/better-auth` package
remains the working reference.
