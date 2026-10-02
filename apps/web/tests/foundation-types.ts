import { getService, authService, translationService, defineAction } from '@bitakit/core';
import type { Services } from '@bitakit/core';
import { useAction, type ActionInput, type ExecutionResult } from '@bitakit/ui/actions';
import { z } from 'zod';

/** Compile-time contract only; never called or bundled into the application. */
export async function verifyServiceTypes(services: Services) {
  const result = await services.users.invitations.invite({ email: 'test@example.com' });
  const invitationId: string = result.invitationId;
  // @ts-expect-error Service methods retain their input type.
  await services.users.invitations.invite({ email: 123 });
  // @ts-expect-error Unknown methods must not become any.
  services.users.invitations.missing();
  // @ts-expect-error Return values retain their shape.
  void result.unknownProperty;
  // App-level services sit directly under services; plugin services under their plugin.
  const theme: 'light' | 'dark' | 'system' = services.theme.get().value;
  return [invitationId, theme];
}

export const typedSchemaAction = defineAction({
  input: z.object({ email: z.email() }),
  execute: ({ services, input }) => services.users.invitations.invite(input),
  success: ({ result, input }) => {
    const id: string = result.invitationId;
    // @ts-expect-error The result is inferred from execute, not widened to any.
    void result.missing;
    // @ts-expect-error The input is inferred from the schema.
    void input.missing;
    return `${id}: ${input.email}`;
  },
  failure: ({ error }) => {
    // @ts-expect-error Errors must be narrowed before accessing their properties.
    void error.message;
    return false;
  },
});

export const typedCommand = defineAction({
  execute: ({ services }) => services.users.invitations.invite({ email: 'test@example.com' }),
  success: ({ result }) => {
    // @ts-expect-error Command results retain the service return type too.
    void result.missing;
    return result.invitationId;
  },
});

export async function verifyIntegrationTypes(services: Services) {
  const userId: string | undefined = getService(services, authService).getSnapshot().user?.id;
  await getService(services, authService).signOut();
  const title: string = getService(services, translationService).translate('Nav.logout');
  // @ts-expect-error The shared auth contract does not expose provider internals.
  void getService(services, authService).$store;
  // @ts-expect-error The shared sign-out operation takes no arbitrary payload.
  await getService(services, authService).signOut({ userId });
  return title;
}

/** Discovered definitions type their IDs, inputs and results; strict mode rejects unknown IDs. */
export function useVerifyActionTypes() {
  const enabled = useAction('demo.enabled');
  void enabled?.execute(true);
  // @ts-expect-error A discovered action's input follows its definition.
  void enabled?.execute('yes');
  const hello = useAction('demo.hello');
  const message: Promise<ExecutionResult<string>> | undefined = hello?.execute();
  const send = useAction('users.send-invite', { email: 'test@example.com' });
  void send?.execute({ email: 'test@example.com' });
  // @ts-expect-error The schema types the input of users.send-invite.
  void send?.execute({ email: 1 });
  // @ts-expect-error Strict action IDs reject actions that discovery did not find.
  useAction('not.registered');
  const theme: ActionInput<'theme.set'> = 'dark';
  return [message, theme];
}
