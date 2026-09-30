import type { SettingsScope } from '@bitakit/app-preferences/core';
/** Pure authorization decision, used only with server-verified identity/membership. */
export function settingsAccess(
  scope: SettingsScope,
  userId: string | undefined,
  organizationId: string | undefined,
  role: string | undefined,
  globalAdmin = false,
) {
  if (!userId) throw new Error('Sign in to access settings.');
  if (scope === 'user') return { owner: userId, userId, organizationId: null, writable: true };
  if (scope === 'organization') {
    if (!organizationId || !role) throw new Error('Organization access denied.');
    return {
      owner: organizationId,
      userId: null,
      organizationId,
      writable: role.split(',').some((value) => ['owner', 'admin'].includes(value.trim())),
    };
  }
  return { owner: 'global', userId: null, organizationId: null, writable: globalAdmin };
}
