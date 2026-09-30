import 'server-only';
import { headers } from 'next/headers';
import { getAuth } from '@/lib/auth';
import { getSessionCookie } from 'better-auth/cookies';
import { getDatabase } from '@/lib/db';
import { settingDefinitions } from '../definitions';
import { settingsAccess } from './access';

export function findSetting(key: string) {
  const setting = settingDefinitions.find((item) => item.key === key);
  if (!setting) throw new Error('Unknown setting.');
  return setting;
}
export function defaultSettingValue(key: string) {
  const setting = findSetting(key);
  const raw = setting.environmentDefault ? process.env[setting.environmentDefault] : undefined;
  return raw === undefined ? setting.defaultValue : setting.fromEnvironment(raw);
}
export async function settingAccess(key: string, organizationId?: string, expectedUserId?: string) {
  const setting = findSetting(key);
  const requestHeaders = await headers();
  const session = getSessionCookie(requestHeaders)
    ? await getAuth().api.getSession({ headers: requestHeaders })
    : null;
  if (session?.user.id !== expectedUserId)
    throw new Error('Settings identity changed; reload settings.');
  if (!session) return { setting, access: null };
  let role: string | undefined;
  if (setting.scope === 'organization' && organizationId) {
    role = (
      await getDatabase().member.findFirst({
        where: { userId: session.user.id, organizationId, disabled: false },
      })
    )?.role;
  }
  // Global writers must be explicitly configured; org-admin is not app-admin.
  const globalAdmin = (process.env.APP_SETTINGS_ADMIN_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(session.user.id);
  return {
    setting,
    access: settingsAccess(setting.scope, session.user.id, organizationId, role, globalAdmin),
  };
}
