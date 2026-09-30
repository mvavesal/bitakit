import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList, URLAction } from '../dist/actions/core.js';

test('headless URL actions require explicit navigation and accept the host adapter', async () => {
  const list = createActionList();
  list.add('open', new URLAction('/settings'));
  const stop = list.mount();
  await assert.rejects(list.execute('open'), /Navigation/);
  stop();

  const visits = [];
  const disconnect = list.mount((href) => visits.push(href));
  await list.execute('open');
  assert.deepEqual(visits, ['/settings']);
  disconnect();
});
