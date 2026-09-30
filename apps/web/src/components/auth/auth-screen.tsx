import Link from 'next/link';
import GalleryVerticalEndIcon from 'reicon-react/icons/Layers';
import { LoginForm } from '@/components/auth/login-form';

export function AuthScreen({ mode, returnTo = '/dashboard' }: { mode: 'login' | 'register';returnTo?:string }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div
            data-corner="theme"
            className="flex size-6 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          >
            <GalleryVerticalEndIcon className="size-4" aria-hidden="true" />
          </div>
          SaaS Foundation
        </Link>
        <LoginForm mode={mode} returnTo={returnTo} />
      </div>
    </main>
  );
}
