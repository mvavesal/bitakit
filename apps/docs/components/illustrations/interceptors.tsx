'use client';
import { useId, useState } from 'react';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { Frame, Explanation, targetStyle } from './shared';

const operations = {
  actions: ['todos.add', 'todos.list', 'todos.remove', 'counter.increment'],
  services: ['todos.items.add()', 'todos.items.list()', 'counter.value.increment()'],
};

// Authored examples, not a second implementation of interceptor matching.
const examples = {
  actions: [
    {
      key: 'one',
      label: 'One Action',
      target: "action: 'todos.add'",
      matched: ['todos.add'],
      file: 'src/plugins/todos/interceptors/log.ts',
      explanation: 'Log completion of todos.add. Other Actions keep running without this observer.',
    },
    {
      key: 'plugin',
      label: 'Todos Actions',
      target: "action: 'todos.*'",
      matched: ['todos.add', 'todos.list', 'todos.remove'],
      file: 'src/plugins/todos/interceptors/log.ts',
      explanation:
        'The prefix selects todos.add, todos.list and other todos Actions. These are Action IDs, not Action groups.',
    },
    {
      key: 'all',
      label: 'All Actions',
      target: "action: '*'",
      matched: operations.actions,
      file: 'src/interceptors/log-actions.ts',
      explanation:
        "An app-level interceptor has global scope by default. Inside a plugin, set scope to 'global' to observe other plugins too.",
    },
  ],
  services: [
    {
      key: 'one',
      label: 'One method',
      target: "service: 'todos.items',\n  method: 'add'",
      matched: ['todos.items.add()'],
      file: 'src/plugins/todos/interceptors/log-method.ts',
      explanation:
        'Observe calls to add through the todos.items service. Other methods are unaffected by this observer.',
    },
    {
      key: 'service',
      label: 'Whole service',
      target: "service: 'todos.items'",
      matched: ['todos.items.add()', 'todos.items.list()'],
      file: 'src/plugins/todos/interceptors/log-service.ts',
      explanation:
        'Omit method to observe every public method called through this service. Internal self-calls bypass the wrapper.',
    },
    {
      key: 'all',
      label: 'All services',
      target: "service: '*'",
      matched: operations.services,
      file: 'src/interceptors/log-services.ts',
      explanation:
        'The wildcard observes methods on all matching service instances. Service interceptors do not have the Action scope option.',
    },
  ],
};

export function InterceptorIllustration({ kind }: { kind: 'actions' | 'services' }) {
  const [selected, select] = useState('one');
  const details = useId();
  const current = examples[kind].find((item) => item.key === selected)!;
  const hook =
    kind === 'actions'
      ? "after: ({ id }) => console.debug('Completed:', id),"
      : "before: ({ service, method }) => console.debug('Called:', service, method),";
  const code = `import { defineInterceptor } from '@bitakit/core';

export default defineInterceptor({
  ${current.target},
  ${hook}
});`;
  return (
    <Frame
      label={`Explore ${kind === 'actions' ? 'Action' : 'service'} interceptor targets`}
      caption="Select a target to see which example operations it observes and the corresponding logging definition. This illustrates selection; it does not execute operations."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Interceptor target">
        {examples[kind].map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected === item.key}
            aria-controls={details}
            className={buttonVariants({
              color: selected === item.key ? 'primary' : 'outline',
              size: 'sm',
            })}
            onClick={() => select(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="grid list-none gap-2 rounded-xl border border-fd-border bg-fd-card p-4 sm:grid-cols-2">
        {operations[kind].map((name) => {
          const observed = current.matched.includes(name);
          return (
            <li key={name} className={targetStyle(observed)} data-observed={observed}>
              <code className="break-all">{name}</code>
              <span className="mt-1 block text-xs">
                {observed ? 'Observed' : 'Outside this target'}
              </span>
            </li>
          );
        })}
      </ul>
      <Explanation id={details} region={current} file={current.file} code={code} />
    </Frame>
  );
}
