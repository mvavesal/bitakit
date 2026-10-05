'use client';
import type { ComponentType, ReactNode } from 'react';
import {
  useAuth as useFoundationAuth,
  useFoundation,
  useFoundationReady,
  useTranslation,
} from '@bitakit/ui';
import {
  ActiveSessions,
  ChangeEmail,
  ChangePassword,
  LinkedAccounts,
  UserProfile,
} from '@better-auth-ui/heroui';
import { useAuth } from '@better-auth-ui/react';
import ShieldIcon from 'reicon-react/icons/Shield';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '../components/ui/empty.js';
import { Button } from '../components/ui/button.js';

export type AccountSettingsPageProps = {
  /** Optional local demo profile shown while nobody is signed in; never treated as an account. */
  profileFallback?: ComponentType;
};

function SignInPrompt() {
  const translateUI = useTranslation();
  const config = useAuth();
  return (
    <Empty role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{translateUI('foundationUI.account.logIn', undefined, 'Log in')}</EmptyTitle>
        <EmptyDescription>
          {translateUI(
            'foundationUI.account.signInToAccessTheseAccountSettings',
            undefined,
            'Sign in to access these account settings.',
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <a href={`${config.basePaths.auth}/${config.viewPaths.auth.signIn}`}>
            {translateUI('foundationUI.account.logIn', undefined, 'Log in')}
          </a>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

/** Authentication is optional for standalone organization demos; installed auth must settle. */
export function SettingsAccountAccess({ children }: { children: ReactNode }) {
  const ready = useFoundationReady();
  const { runtime } = useFoundation();
  const session = useFoundationAuth();
  const translateUI = useTranslation();
  if (!ready || (runtime.hasService('auth') && session.pending))
    return (
      <Empty role="status">
        <EmptyHeader>
          <EmptyTitle>
            {translateUI('foundationUI.account.checkingSignin', undefined, 'Checking sign-in…')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  if (runtime.hasService('auth') && !session.user) return <SignInPrompt />;
  return children;
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

/** Profile content can be mounted independently in any settings frame. */
export function AccountProfileAccess({
  profileFallback: Fallback,
  children,
}: AccountSettingsPageProps & { children: ReactNode }) {
  const translateUI = useTranslation();
  const session = useFoundationAuth();
  if (session.pending)
    return (
      <p role="status">
        {translateUI('foundationUI.account.checkingSignin', undefined, 'Checking sign-in…')}
      </p>
    );
  if (!session.user) return Fallback ? <Fallback /> : <SignInPrompt />;
  return children;
}

export function AccountProfileSettings(props: AccountSettingsPageProps) {
  return (
    <AccountProfileAccess {...props}>
      <UserProfile />
    </AccountProfileAccess>
  );
}

/** Native security cards, independently composable and provider-configured. */
export function AccountSecuritySettings() {
  const translateUI = useTranslation();
  const session = useFoundationAuth();
  if (session.pending)
    return (
      <p role="status">
        {translateUI('foundationUI.account.checkingSignin', undefined, 'Checking sign-in…')}
      </p>
    );
  return session.user ? <SecurityContent /> : <SignInPrompt />;
}

/** Combined composition retained for hosts that intentionally mount both sections. */
export function AccountSettingsPage(props: AccountSettingsPageProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <AccountProfileSettings {...props} />
      <AccountSecuritySettings />
    </div>
  );
}
