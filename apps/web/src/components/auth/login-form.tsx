'use client';
import { useTranslations } from 'next-intl';

import { useActionState } from 'react';
import Link from 'next/link';
import { login, register } from '@/app/auth-actions';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CircleAlertIcon from 'reicon-react/icons/AlertCircle';
import { Input } from '@/components/ui/input';

export function LoginForm({
  mode = 'login',
  returnTo = '/dashboard',
  className,
  ...props
}: React.ComponentProps<'div'> & { mode?: 'login' | 'register'; returnTo?: string }) {
  const t = useTranslations('Auth');
  const isRegister = mode === 'register';
  const [state, action, pending] = useActionState(isRegister ? register : login, { error: '' });
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>
            <h1>{isRegister ? t('createTitle') : t('welcome')}</h1>
          </CardTitle>
          <CardDescription>{isRegister ? t('createIntro') : t('loginIntro')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <FieldGroup>
              {state.error && (
                <Alert variant="destructive">
                  <CircleAlertIcon aria-hidden="true" />
                  <AlertTitle>{t('unable')}</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <Field data-disabled>
                <Button variant="outline" type="button" disabled>
                  <svg
                    data-icon="inline-start"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  {t('apple')}
                </Button>
                <Button variant="outline" type="button" disabled>
                  <svg
                    data-icon="inline-start"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {t('google')}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                {t('emailAlternative')}
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={isRegister ? 8 : 1}
                  maxLength={128}
                />
                {isRegister && <FieldDescription>{t('length')}</FieldDescription>}
              </Field>
              <Field>
                <Button type="submit" disabled={pending}>
                  {pending ? t('wait') : isRegister ? t('create') : t('login')}
                </Button>
                <FieldDescription className="text-center">
                  {isRegister ? (
                    <>
                      {t('hasAccount')}{' '}
                      <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
                        {t('logIn')}
                      </Link>
                    </>
                  ) : (
                    <>
                      {t('new')}{' '}
                      <Link href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>
                        {t('createLink')}
                      </Link>
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <FieldDescription>{t('providers')}</FieldDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
