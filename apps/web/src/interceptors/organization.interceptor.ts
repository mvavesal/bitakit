import type { ActionInterceptor } from '@bitakit/ui/actions';
import { authClient } from '@/lib/auth-client';
import { defineInterceptor, type Confirmation } from '@bitakit/core';
export class AppActionInterceptor implements ActionInterceptor {
  constructor(private confirm: (request: Confirmation) => Promise<boolean>) {}
  async before(context: Parameters<ActionInterceptor['before']>[0]) {
    const input = context.input;
    const organizationId =
      input && typeof input === 'object' && 'organizationId' in input
        ? input.organizationId
        : undefined;
    const sameOrganization = () =>
      !organizationId ||
      authClient.$store.atoms.session.get().data?.session.activeOrganizationId === organizationId;
    if (!sameOrganization()) return false;
    const metadata = context.get()?.metadata as
      | { confirmation?: (input: unknown) => Confirmation }
      | undefined;
    if (metadata?.confirmation && !(await this.confirm(metadata.confirmation(input)))) return false;
    return sameOrganization();
  }
}

export default defineInterceptor({
  requires: ['confirm'],
  create: ({ services }) => new AppActionInterceptor(services.confirm),
});
