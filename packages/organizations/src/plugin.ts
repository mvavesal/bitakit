import { definePlugin, provideService, serviceKey, getService } from '@bitakit/core';
import type { OrganizationBackend } from './contracts.js';
import { createOrganizationService, type OrganizationService } from './services/organizations.js';

export const organizationService = serviceKey<OrganizationService>('organizations');
/** Headless plugin: the backend is created for each mount, never shared globally. */
export function organizationsPlugin(createBackend: () => OrganizationBackend) {
  return definePlugin({
    id: 'organizations',
    metadata: { name: 'Organisations-Service', description: 'Gemeinsamer Zugriff auf Organisationen und Mitgliedschaften.' },
    services: [
      provideService(organizationService, {
        create: () => createOrganizationService(createBackend()),
        dispose: (service) => service.dispose(),
      }),
    ],
    setup: ({ services }) => {
      // The service exposes load failures to the UI and permits retry.
      void getService(services, organizationService)
        .refresh()
        .catch(() => {});
    },
  });
}
