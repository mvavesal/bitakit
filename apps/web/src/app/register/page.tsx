import { authReturnPath } from '@/lib/auth/return-path';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';

export const metadata: Metadata = { title: 'Create account · SaaS Foundation' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const target = authReturnPath((await searchParams).returnTo);
  return <AuthScreen mode="register" returnTo={target} />;
}
