// Server kernel benchmark: boot time and per-call overhead of in-process calls.
// `node bench/server-kernel.mjs` prints the numbers next to the blueprint's strict targets
// (p50 ≤ 1 µs, p99 ≤ 5 µs at 1,000 operations); core's test suite asserts looser CI-safe
// limits through `measure` (tests/server-perf.test.mjs). Run `npm run build` first.
import {
  createServer,
  defineAction,
  defineEvents,
  definePlugin,
  defineService,
  event,
} from '../dist/server/index.js';

const now = () => process.hrtime.bigint();
const micros = (nanos) => Number(nanos) / 1000;
const percentile = (sorted, share) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];

/** A composition with `count` public operations in one plugin, each returning its index. */
export function composition(count) {
  const actions = {};
  for (let index = 0; index < count; index++)
    actions[`op${index}`] = defineAction({ access: 'public', execute: () => index });
  return { plugins: [definePlugin({ id: 'bench', actions })] };
}

/** Milliseconds from createServer to ready, the fastest of `runs`. */
export async function bootTime(count, runs = 3) {
  let best = Infinity;
  for (let run = 0; run < runs; run++) {
    const config = composition(count);
    const started = now();
    const server = createServer(config);
    await server.ready;
    best = Math.min(best, micros(now() - started) / 1000);
    await server.stop();
  }
  return best;
}

/** p50/p99 in microseconds of sequential in-process calls over `count` operations. */
export async function latency(count, calls = 20_000, warmup = 20_000) {
  const server = createServer(composition(count));
  try {
    const caller = server.as(new Headers());
    const operations = Array.from({ length: count }, (_, index) => caller.bench[`op${index}`]);
    for (let index = 0; index < warmup; index++) await operations[index % count]();
    const samples = new Array(calls);
    for (let index = 0; index < calls; index++) {
      const operation = operations[index % count];
      const started = now();
      await operation();
      samples[index] = now() - started;
    }
    samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return { p50: micros(percentile(samples, 0.5)), p99: micros(percentile(samples, 0.99)) };
  } finally {
    await server.stop();
  }
}

/**
 * p50/p99 in microseconds of an operation that emits one event while `listened` declared events
 * each have one exact listener (registered by a service): an emit must not grow with them.
 * `delivered` counts the listener runs, so a skipped delivery cannot pass for a fast one.
 */
export async function emitLatency(listened, calls = 5_000, warmup = 5_000) {
  const names = Array.from({ length: listened }, (_, index) => `e${index}`);
  let delivered = 0;
  const server = createServer({
    plugins: [
      definePlugin({
        id: 'bench',
        events: defineEvents(Object.fromEntries(names.map((name) => [name, event()]))),
        services: {
          listeners: defineService(({ events }) => {
            for (const name of names) events.on(`bench.${name}`, () => void (delivered += 1));
            return {};
          }),
        },
        actions: {
          emit: defineAction({
            access: 'public',
            execute: ({ events }) => events.emit('bench.e0'),
          }),
        },
      }),
    ],
  });
  try {
    const emit = server.as(new Headers()).bench.emit;
    for (let index = 0; index < warmup; index++) await emit();
    const samples = new Array(calls);
    for (let index = 0; index < calls; index++) {
      const started = now();
      await emit();
      samples[index] = now() - started;
    }
    samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      p50: micros(percentile(samples, 0.5)),
      p99: micros(percentile(samples, 0.99)),
      delivered,
      expected: warmup + calls,
    };
  } finally {
    await server.stop();
  }
}

/** `total` calls with `inFlight` running at once; counts the calls that answered correctly. */
export async function throughput(count = 1000, total = 100_000, inFlight = 1000) {
  const server = createServer(composition(count));
  try {
    const caller = server.as(new Headers());
    let next = 0;
    let correct = 0;
    const started = now();
    const worker = async () => {
      while (next < total) {
        const index = next++;
        if ((await caller.bench[`op${index % count}`]()) === index % count) correct += 1;
      }
    };
    await Promise.all(Array.from({ length: inFlight }, worker));
    return { total, correct, milliseconds: micros(now() - started) / 1000 };
  } finally {
    await server.stop();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const count of [1, 1000]) {
    const { p50, p99 } = await latency(count);
    console.log(
      `${count} operation(s): p50 ${p50.toFixed(2)} µs (strict ≤ 1), p99 ${p99.toFixed(2)} µs (strict ≤ 5)`,
    );
  }
  for (const listened of [1, 200]) {
    const { p50, p99 } = await emitLatency(listened);
    console.log(
      `emit with ${listened} listened event(s): p50 ${p50.toFixed(2)} µs, p99 ${p99.toFixed(2)} µs`,
    );
  }
  const boots = [];
  for (const count of [1000, 4000]) boots.push(await bootTime(count));
  console.log(
    `boot: 1,000 operations ${boots[0].toFixed(1)} ms, 4,000 operations ${boots[1].toFixed(1)} ms (ratio ${(boots[1] / boots[0]).toFixed(2)}; linear ≈ 4)`,
  );
  const run = await throughput();
  console.log(
    `throughput: ${run.correct}/${run.total} correct with 1,000 in flight in ${run.milliseconds.toFixed(0)} ms`,
  );
}
