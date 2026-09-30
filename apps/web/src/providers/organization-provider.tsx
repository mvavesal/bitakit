'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

type ActiveOrganization = ReturnType<typeof authClient.useActiveOrganization>;
const OrganizationContext = createContext<ActiveOrganization | null>(null);
/** Better Auth remains the only owner of organization/session state. */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const active = authClient.useActiveOrganization();
  const { data: session, isPending } = authClient.useSession();
  const id = session?.session.activeOrganizationId;
  const matching = active.data?.id === id;
  return (
    <OrganizationContext.Provider
      value={{
        ...active,
        data: matching ? active.data : null,
        isPending: isPending || active.isPending || (!!id && !matching && !active.error),
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
export function useActiveOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('OrganizationProvider is required.');
  return context;
}
