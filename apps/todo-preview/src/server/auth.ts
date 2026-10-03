import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization, multiSession, twoFactor } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';

/** This sample uses native auth with disposable local data, never a production database. */
const createAuth = () => betterAuth({
  baseURL: 'http://127.0.0.1:3103',
  secret: randomBytes(32).toString('hex'),
  database: memoryAdapter({ user: [], session: [], account: [], verification: [], organization: [], member: [], invitation: [], team: [], teamMember: [], twoFactor: [], apikey: [] }),
  emailAndPassword: { enabled: true },
  plugins: [organization({ teams: { enabled: true } }), multiSession(), twoFactor(), apiKey()],
});

// Next route modules share this native memory adapter, including across development reloads.
const preview = globalThis as typeof globalThis & {
  todoPreviewAuth?: ReturnType<typeof createAuth>;
  todoPreviewSeeded?: Promise<void>;
};
export const auth = preview.todoPreviewAuth ??= createAuth();
export function seedPreview() {
  if (process.env.TODO_PREVIEW_AUTH !== 'memory' || !process.env.TODO_PREVIEW_PASSWORD)
    throw new Error('Enable the local memory preview in .env.local.');
  return preview.todoPreviewSeeded ??= (async () => {
    const password = process.env.TODO_PREVIEW_PASSWORD!;
    const alice = await auth.api.signUpEmail({ body: { name: 'Alice (test)', email: 'alice@example.test', password } });
    const bob = await auth.api.signUpEmail({ body: { name: 'Bob (test)', email: 'bob@example.test', password } });
    const studio = await auth.api.createOrganization({ body: { name: 'Design Studio', slug: 'design-studio', userId: alice.user.id } });
    await auth.api.createOrganization({ body: { name: 'Alice private team', slug: 'alice-private', userId: alice.user.id } });
    await auth.api.addMember({ body: { organizationId: studio!.id, userId: bob.user.id, role: 'member' } });
  })();
}
