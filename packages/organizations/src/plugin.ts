import { definePlugin, defineService, serviceKey, getService } from '@bitakit/core';
import type { OrganizationBackend } from './contracts.js';
import { createOrganizationService, type OrganizationService } from './services/organizations.js';

export const organizationService = serviceKey<OrganizationService>('organizations');
/**
 * The organization data source. A host provides it once, for example in
 * `src/services/organization-backend.ts`:
 * `export default defineService(() => createDemoOrganizationBackend(), { provides: organizationBackend })`.
 * The name is not `organizations.backend`: `organizations` is already the service itself.
 */
export const organizationBackend = serviceKey<OrganizationBackend, 'organization-backend'>(
  'organization-backend',
);
/** Headless plugin: the backend service is created for each mount, never shared globally. */
export function organizationsPlugin() {
  return definePlugin({
    id: 'organizations',
    metadata: {
      name: 'Organization service',
      description: 'Shared access to organizations and memberships.',
    },
    // The contract key equals the plugin ID, so the service is an array entry.
    services: [
      defineService(
        ({ services, onStop }) => {
          const service = createOrganizationService(getService(services, organizationBackend));
          onStop(() => service.dispose());
          return service;
        },
        { requires: [organizationBackend], provides: organizationService },
      ),
    ],
    setup: ({ services }) => {
      // The service exposes load failures to the UI and permits retry.
      void getService(services, organizationService)
        .refresh()
        .catch(() => {});
    },
  });
}
