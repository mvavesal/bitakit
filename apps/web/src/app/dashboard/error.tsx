'use client';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { logout } from '@/app/auth-actions';

export default function DashboardError() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <Alert variant="destructive">
        <AlertTitle>Connection failed</AlertTitle>
        <AlertDescription>
          Your session could not be verified. Please check the connection and try again.
        </AlertDescription>
      </Alert>
      <div className="flex gap-3">
        <form action="/dashboard" method="get">
          <Button type="submit">Check again</Button>
        </form>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </div>
    </main>
  );
}
