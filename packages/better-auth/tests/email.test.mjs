import test from 'node:test';
import assert from 'node:assert/strict';
import { betterAuthEmail } from '../dist/email.js';
test('all auth email hooks use the replaceable service and the configured invitation route', async () => {
  const sent = [];
  const mail = betterAuthEmail(
    {
      send: async (message) => {
        sent.push(message);
        return { messageId: 'test' };
      },
    },
    { invitationURL: (id) => `https://example.test/invites/${encodeURIComponent(id)}` },
  );
  await mail.sendVerificationEmail({
    user: { email: 'one@example.test' },
    url: 'https://example.test/verify',
  });
  await mail.sendResetPassword({
    user: { email: 'one@example.test' },
    url: 'https://example.test/reset',
  });
  await mail.sendInvitationEmail({
    id: 'one/two',
    email: 'two@example.test',
    organization: { name: 'Studio' },
  });
  assert.equal(sent.length, 3);
  assert.match(sent[2].text, /one%2Ftwo/);
  assert.equal(sent[2].to, 'two@example.test');
});
