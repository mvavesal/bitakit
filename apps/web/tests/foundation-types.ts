import { getService, authService, translationService } from '@bitakit/core';
import type { Services } from '@bitakit/core';
import { defineAction, defineFormAction } from '@bitakit/core';
import {
  useAction,
  type ActionId,
  type ActionInput,
  type ExecutionResult,
} from '@bitakit/ui/actions';

/** Compile-time contract only; never called or bundled into the application. */
export async function verifyServiceTypes(services: Services) {
  const result = await services.users.invite({ email: 'test@example.com' });
  const invitationId: string = result.invitationId;
  // @ts-expect-error Service methods retain their input type.
  await services.users.invite({ email: 123 });
  // @ts-expect-error Unknown methods must not become any.
  services.users.missing();
  // @ts-expect-error Return values retain their shape.
  void result.unknownProperty;
  return invitationId;
}

export const typedForm = defineFormAction({
  fields: { email: { type: 'email', required: true } },
  submit: (input, { services }) => services.users.invite(input),
  success: ({ result, input }) => {
    const id: string = result.invitationId;
    // @ts-expect-error The result is inferred from submit, not widened to any.
    void result.missing;
    // @ts-expect-error Form input is inferred from the declared fields.
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
  execute: ({ services }) => services.users.invite({ email: 'test@example.com' }),
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

/** Discovered definitions type their IDs, inputs and results; class exports are excluded by design. */
export function useVerifyActionTypes() {
  const enabled = useAction('demo.enabled');
  void enabled?.execute(true);
  // @ts-expect-error A discovered command's input follows its definition.
  void enabled?.execute('yes');
  const hello = useAction('demo.hello');
  const message: Promise<ExecutionResult<string>> | undefined = hello?.execute();
  // A form opener receives untyped context; its field values belong to the submission.
  const invite = useAction('users.invite');
  void invite?.execute({ organizationId: 'org' });
  // Unknown IDs stay allowed and untyped unless ActionMapOptions enables strict mode.
  const dynamic: ActionId = 'not.registered';
  const untyped: ActionInput<'not.registered'> = { anything: true };
  return [message, dynamic, untyped];
}
