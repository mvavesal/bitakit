'use client';
import { useTranslation } from '@bitakit/ui';
import { useSyncExternalStore, type ComponentType } from 'react';
import { authService, getService } from '@bitakit/core';
import { useFoundation } from '@bitakit/ui';
import {
  SettingsSection,
  type AppPreferences,
  type SectionOptions,
} from '@bitakit/app-preferences/core';
import {
  ActiveSessions,
  ChangeEmail,
  ChangePassword,
  LinkedAccounts,
  UserProfile,
} from '@better-auth-ui/heroui';
import { useAuth } from '@better-auth-ui/react';
import UserIcon from 'reicon-react/icons/User';
import ShieldIcon from 'reicon-react/icons/Shield';

export type AccountSettingsOptions = {
  catalog: AppPreferences;
  category?: SectionOptions['category'];
  /** Optional host demo content, never treated as an authenticated account. */
  profileFallback?: ComponentType;
};

function AccountContent({
  profile,
  fallback: Fallback,
}: {
  profile?: boolean;
  fallback?: ComponentType;
}) {
  const translateUI = useTranslation();
  const auth = getService(useFoundation().runtime.services, authService);
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot, auth.getSnapshot);
  const config = useAuth();
  if (session.pending) return <p role="status">{translateUI("foundationUI.account.checkingSignin", undefined, "Anmeldung wird geprüft …")}</p>;
  if (!session.user)
    return profile && Fallback ? (
      <Fallback />
    ) : (
      <p>
        {translateUI("foundationUI.account.signInToAccessTheseAccountSettings", undefined, "Für diese Kontoeinstellungen benötigst du eine echte Anmeldung.")}{' '}
        <a className="underline" href={`${config.basePaths.auth}/${config.viewPaths.auth.signIn}`}>
          {translateUI("foundationUI.account.logIn", undefined, "Anmelden")}</a>
      </p>
    );
  if (profile) return <UserProfile />;
  const ChangeEmailCard =
    config.plugins.find((plugin) => plugin.cardOverrides?.account?.changeEmail)?.cardOverrides
      ?.account?.changeEmail ?? ChangeEmail;
  const showEmail =
    config.emailAndPassword?.enabled ||
    config.plugins.some(
      (plugin) => plugin.id === 'magicLink' || plugin.cardOverrides?.account?.changeEmail,
    );
  return (
    <div className="flex w-full flex-col gap-4 md:gap-6">
      {showEmail && <ChangeEmailCard />}
      {config.emailAndPassword?.enabled && <ChangePassword />}
      {!!config.socialProviders?.length && <LinkedAccounts />}
      {config.plugins
        .filter((plugin) => plugin.id === 'twoFactor')
        .flatMap((plugin) =>
          plugin.securityCards?.map((Card, index) => (
            <div key={`${plugin.id}-${index}`} data-two-factor-settings>
              <Card />
            </div>
          )),
        )}
      <ActiveSessions />
    </div>
  );
}

/** Plugin-owned account pages, separate from the upstream component showcase. */
export function accountSettingsSections(options: AccountSettingsOptions) {
  const category = options.category ?? { id: 'personal', title: 'Mein Konto', order: 0 };
  return [
    new SettingsSection({
      id: 'profile',
      title: 'Profil',
      description: 'Dein Profilbild und deine persönlichen Angaben.',
      category,
      icon: UserIcon,
      pluginId: 'better-auth-ui',
      showHeader: false,
      component: () => <AccountContent profile fallback={options.profileFallback} />,
    }),
    new SettingsSection({
      id: 'security',
      title: 'Sicherheit',
      description:
        'E-Mail-Adresse, Passwort, Zwei-Faktor-Authentifizierung, verknüpfte Konten und aktive Sitzungen.',
      category,
      icon: ShieldIcon,
      pluginId: 'better-auth-ui',
      component: () => <AccountContent />,
    }),
  ];
}
