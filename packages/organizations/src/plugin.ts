import { definePlugin, defineService, serviceKey, getService } from '@bitakit/core';
import type { OrganizationBackend } from './contracts.js';
import { createOrganizationService, type OrganizationService } from './services/organizations.js';

export const organizationService = serviceKey<OrganizationService>('organizations');
/** Headless plugin: the backend is created for each mount, never shared globally. */
export function organizationsPlugin(createBackend: () => OrganizationBackend) {
  return definePlugin({
    id: 'organizations',
    metadata: {
      name: 'Organization service',
      description: 'Shared access to organizations and memberships.',
    },
    services: [
      defineService(
        ({ onStop }) => {
          const service = createOrganizationService(createBackend());
          onStop(() => service.dispose());
          return service;
        },
        { provides: organizationService },
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
