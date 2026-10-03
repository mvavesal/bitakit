'use client';
import type { ComponentType } from 'react';
import { useAuth as useFoundationAuth, useTranslation } from '@bitakit/ui';
import {
  ActiveSessions,
  ChangeEmail,
  ChangePassword,
  LinkedAccounts,
  UserProfile,
} from '@better-auth-ui/heroui';
import { useAuth } from '@better-auth-ui/react';
import { PageHeader } from '../components/ui/index.js';

export type AccountSettingsPageProps = {
  /** Optional local demo profile shown while nobody is signed in; never treated as an account. */
  profileFallback?: ComponentType;
};

function SignInPrompt() {
  const translateUI = useTranslation();
  const config = useAuth();
  return (
    <p>
      {translateUI(
        'foundationUI.account.signInToAccessTheseAccountSettings',
        undefined,
        'Sign in to access these account settings.',
      )}{' '}
      <a className="underline" href={`${config.basePaths.auth}/${config.viewPaths.auth.signIn}`}>
        {translateUI('foundationUI.account.logIn', undefined, 'Log in')}
      </a>
    </p>
  );
}

/** Email, password, linked accounts, two-factor authentication and sessions, as configured upstream. */
function SecurityContent() {
  const config = useAuth();
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

/**
 * The plugin's account settings page: the profile, then security. The host's settings frame
 * renders the page title and navigation, so both parts start at heading level 2.
 */
export function AccountSettingsPage({ profileFallback: Fallback }: AccountSettingsPageProps) {
  const translateUI = useTranslation();
  const session = useFoundationAuth();
  if (session.pending)
    return (
      <p role="status">
        {translateUI('foundationUI.account.checkingSignin', undefined, 'Checking sign-in…')}
      </p>
    );
  if (!session.user && !Fallback) return <SignInPrompt />;
  return (
    <div className="flex w-full min-w-0 flex-col gap-10">
      <section className="flex min-w-0 flex-col gap-6">
        <PageHeader
          level={2}
          title={translateUI('foundationUI.account.profile', undefined, 'Profile')}
          subtitle={translateUI(
            'foundationUI.account.yourProfilePictureAndPersonalDetails',
            undefined,
            'Your profile picture and personal details.',
          )}
        />
        {session.user ? <UserProfile /> : Fallback && <Fallback />}
      </section>
      <section className="flex min-w-0 flex-col gap-6">
        <PageHeader
          level={2}
          title={translateUI('foundationUI.account.security', undefined, 'Security')}
          subtitle={translateUI(
            'foundationUI.account.emailPasswordTwoFactorAuthenticationLinkedAccountsAndActiveSessions',
            undefined,
            'Email, password, two-factor authentication, linked accounts and active sessions.',
          )}
        />
        {session.user ? <SecurityContent /> : <SignInPrompt />}
      </section>
    </div>
  );
}
