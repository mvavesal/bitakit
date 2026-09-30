import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailService } from '../dist/service.js';
import { nodemailerPlugin } from '../dist/index.js';
import { createActionList, FoundationRuntime, getService } from '@bitakit/core';
import { emailService } from '@bitakit/email';

test('mail service forwards only allowed fields and owns transport disposal', async () => {
  const messages = [];
  let closed = 0;
  let verified = 0;
  const service = createMailService(
    {
      sendMail: async (message) => {
        messages.push(message);
        return { messageId: 'test' };
      },
      verify: async () => {
        verified++;
      },
      close: () => {
        closed++;
      },
    },
    'Demo <sender@example.test>',
  );
  await service.verify();
  assert.equal(verified, 1);
  assert.deepEqual(
    await service.send({
      to: 'person@example.test',
      subject: 'Test',
      text: 'Hello',
      from: 'attacker@example.test',
      attachments: ['not-allowed'],
    }),
    { messageId: 'test' },
  );
  assert.equal(messages[0].from, 'Demo <sender@example.test>');
  assert.equal(messages[0].attachments, undefined);
  await assert.rejects(service.send({ to: 'bad', subject: 'Test', text: 'Hello' }), /Invalid/);
  await assert.rejects(service.send({ to: 'person@example.test', subject: 'Test' }), /body/);
  service.dispose();
  service.dispose();
  assert.equal(closed, 1);
  await assert.rejects(
    service.send({ to: 'person@example.test', subject: 'Test', text: 'Hello' }),
    /disposed/,
  );
});
test('Nodemailer plugin registers without connecting or sending and cleans up on unmount', () => {
  const config = {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    user: 'test',
    password: 'test',
    from: 'sender@example.test',
  };
  assert.throws(() => nodemailerPlugin({ ...config, from: 'Only a name' }), /sender/);
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [nodemailerPlugin(config)],
  });
  const stop = runtime.mount();
  assert.equal(typeof getService(runtime.services, emailService).send, 'function');
  stop();
});
