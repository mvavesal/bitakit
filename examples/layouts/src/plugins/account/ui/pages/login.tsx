'use client';
import { Button, Input, PageHeader } from '@bitakit/ui/components';

// This page joins the `auth` family; the app's src/layouts/auth/split.tsx frames it.
export const layout = 'auth';

export default function LoginPage() {
  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <PageHeader title="Sign in" subtitle="A demo form: nothing is sent." />
      <Input aria-label="Email" type="email" placeholder="you@example.com" />
      <Button type="submit">Continue</Button>
    </form>
  );
}
