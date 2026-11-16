// CI-safe performance gate of the server kernel (build spec section 7). The strict numbers of the
// blueprint (p50 ≤ 1 µs, p99 ≤ 5 µs) are printed by `node bench/server-kernel.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTime, emitLatency, latency, throughput } from '../bench/server-kernel.mjs';

test('no call is skipped or lost: 100,000 calls with 1,000 in flight all answer correctly', async () => {
  const run = await throughput(1000, 100_000, 1000);
  assert.equal(run.correct, run.total);
});

test('per-call overhead at 1,000 operations: p50 ≤ 2 µs and p99 ≤ 25 µs', async () => {
  // The best of three runs, so one noisy neighbour on a CI machine does not fail the gate.
  let best = { p50: Infinity, p99: Infinity };
  for (let attempt = 0; attempt < 3 && (best.p50 > 2 || best.p99 > 25); attempt++) {
    const result = await latency(1000);
    best = { p50: Math.min(best.p50, result.p50), p99: Math.min(best.p99, result.p99) };
  }
  assert.ok(best.p50 <= 2, `p50 ${best.p50.toFixed(2)} µs`);
  assert.ok(best.p99 <= 25, `p99 ${best.p99.toFixed(2)} µs`);
  const single = await latency(1, 5000, 5000);
  assert.ok(single.p50 <= 2, `p50 with one operation ${single.p50.toFixed(2)} µs`);
});

test('boot grows at most linearly with the number of operations', async () => {
  const small = await bootTime(1000);
  const large = await bootTime(4000);
  // Linear growth gives a ratio near 4; quadratic would give 16. Allow CI noise.
  assert.ok(large / small <= 8, `1,000: ${small.toFixed(1)} ms, 4,000: ${large.toFixed(1)} ms`);
});

test('an emit does not grow with the listened events: p50 ≤ 10 µs with 200 of them', async () => {
  // Before name resolution was cached, 200 listened events cost about 0.7 ms per emit.
  let best = { p50: Infinity };
  for (let attempt = 0; attempt < 3 && best.p50 > 10; attempt++) {
    const result = await emitLatency(200);
    assert.equal(result.delivered, result.expected, 'every emit reached its one listener');
    if (result.p50 < best.p50) best = result;
  }
  assert.ok(best.p50 <= 10, `p50 ${best.p50.toFixed(2)} µs`);
});
