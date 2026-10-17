'use client';
import { useEffect, useState, useSyncExternalStore, type ElementType, type ReactNode } from 'react';
import type { BitaKitEvent, BitaKitRuntime } from '@bitakit/core';
import type { InventoryPlugin } from '@bitakit/core';
import { useBitaKit, useBitaKitNavigation, useRuntimeInventory } from '@bitakit/ui';
import { useActions } from '@bitakit/ui/actions';
import { Badge, Button, Input, PageHeader, Separator } from '@bitakit/ui/components';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card.js';

export type InspectorProps = {
  /** ID of the plugin to inspect, for example "notes". */
  plugin: string;
  /** Diagnostic threshold only; never cancels work or releases the cleanup barrier. */
  stalledAfterMs?: number;
};

/**
 * A live developer view of one plugin in the running app: its pages, actions (runnable with
 * JSON input), services, emitted events and configuration declarations. Reads the existing runtime;
 * it keeps no copy of plugin state. Intended for playgrounds and development builds.
 */
export function Inspector({ plugin, stalledAfterMs = 10000 }: InspectorProps) {
  const { runtime } = useBitaKit();
  const ready = useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  const inventory = useRuntimeInventory();
  const module = inventory.static.plugins.find((item) => item.id === plugin);
  if (!module)
    return (
      <PageHeader
        title={`Plugin "${plugin}" is not running`}
        subtitle="Check the plugin ID. If it failed to start, the error is shown in a dialog and in the browser console."
      />
    );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={module.metadata?.name ?? plugin}
        subtitle={module.metadata?.description ?? 'Live view of this plugin in the running app.'}
        trailing={
          <>
            <Badge variant="secondary">{plugin}</Badge>
            <Badge variant="outline">
              {inventory.live?.plugins.find((item) => item.id === plugin)?.phase ?? 'unavailable'}
            </Badge>
            {module.metadata?.version && <Badge variant="outline">{module.metadata.version}</Badge>}
          </>
        }
      />
      <RuntimeStatus plugin={plugin} stalledAfterMs={stalledAfterMs} />
      {ready ? (
        <>
          <Pages module={module} />
          <Actions module={module} runtime={runtime} />
          <Services module={module} runtime={runtime} />
          <Events runtime={runtime} />
          <Configuration plugin={plugin} />
        </>
      ) : (
        <p role="status" className="text-muted-foreground">
          Runtime is {inventory.live?.phase ?? 'unavailable'}.
        </p>
      )}
    </div>
  );
}

function RuntimeStatus({ plugin, stalledAfterMs }: { plugin: string; stalledAfterMs: number }) {
  const { live } = useRuntimeInventory();
  const [now, setNow] = useState(() => Date.now());
  const operation = live?.operation;
  useEffect(() => {
    if (!operation) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [operation]);
  const elapsed = operation ? Math.max(0, now - operation.startedAt) : 0;
  const pending = [...(live?.plugins ?? []), ...(live?.services ?? [])].filter(
    (entry) =>
      ('plugin' in entry ? entry.plugin === plugin : entry.id === plugin) &&
      ['starting', 'stopping'].includes(entry.phase),
  );
  const slots = live?.slots.filter((slot) => slot.plugin === plugin) ?? [];
  return (
    <Section
      title="Runtime status"
      description="Lifecycle and attachments, not proof that an outlet is mounted or visible."
    >
      {operation && (
        <p role="status">
          {operation.kind} · {Math.floor(elapsed / 1000)}s · cleanup: {live?.cleanup}
          {elapsed >= stalledAfterMs &&
            ' — Taking longer than expected. Inspect the named hooks; a deadline does not release cleanup. Restart the host only after stopping its process.'}
        </p>
      )}
      <Rows
        empty="No pending lifecycle work for this plugin."
        items={pending.map((entry) => (
          <span key={entry.id}>
            {entry.id} · {entry.phase} · {Math.floor(Math.max(0, now - entry.since) / 1000)}s
          </span>
        ))}
      />
      <Rows
        empty="No declared slots."
        items={slots.map((slot) => (
          <span key={slot.id}>
            {slot.id} · {slot.phase} · {slot.count} attached · mounted/visible/render failures:
            unavailable
          </span>
        ))}
      />
      <p className="text-muted-foreground">
        For contextual filtering or payload errors, read useSlot().diagnostics in the actual outlet.
        Render failures name the contribution in its recovery UI and SlotRenderError report.
      </p>
    </Section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Rows({ items, empty }: { items: ReactNode[]; empty: string }) {
  if (!items.length) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-3">
          {index > 0 && <Separator />}
          {item}
        </div>
      ))}
    </div>
  );
}

function Pages({ module }: { module: InventoryPlugin }) {
  const { Link } = useBitaKitNavigation();
  const Anchor: ElementType = Link ?? 'a';
  return (
    <Section title="Pages" description="Plugin pages, rendered by the app's catch-all route.">
      <Rows
        empty="This plugin has no pages."
        items={(module.declarations ?? [])
          .filter((item) => item.kind === 'page' && item.id)
          .map((page) => (
            <Button key={page.id!} asChild variant="link" className="self-start px-0">
              <Anchor href={page.id!}>{page.id!}</Anchor>
            </Button>
          ))}
      />
    </Section>
  );
}

function Actions({ module, runtime }: { module: InventoryPlugin; runtime: BitaKitRuntime }) {
  const snapshots = useActions();
  const inventory = useRuntimeInventory();
  const ids = new Set(
    inventory.live?.actions
      .filter((action) => action.plugin === module.id)
      .map((action) => action.id),
  );
  const own = Object.values(snapshots).filter((action) => ids.has(action.id));
  return (
    <Section
      title="Actions"
      description="Live state of each action. Run one with optional JSON input, like a bound button would."
    >
      <Rows
        empty="This plugin has no actions."
        items={own.map((action) => (
          <ActionRow key={action.id} id={action.id} runtime={runtime} />
        ))}
      />
    </Section>
  );
}

function ActionRow({ id, runtime }: { id: string; runtime: BitaKitRuntime }) {
  const action = useActions()[id];
  const [input, setInput] = useState('');
  const [outcome, setOutcome] = useState<string>();
  if (!action) return null;
  const run = async () => {
    let value: unknown;
    try {
      value = input.trim() ? JSON.parse(input) : undefined;
    } catch {
      setOutcome('Input is not valid JSON. Use for example "Buy milk", 42 or {"id": 1}.');
      return;
    }
    try {
      const result = await runtime.actions.execute(id, value);
      setOutcome(
        result.status === 'completed'
          ? `Completed${result.value === undefined ? '' : `: ${format(result.value)}`}`
          : `Skipped: ${result.reason}`,
      );
    } catch (error) {
      setOutcome(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{action.title}</span>
        <span className="text-muted-foreground">{id}</span>
        {!action.enabled && <Badge variant="outline">Disabled</Badge>}
        {!action.visible && <Badge variant="outline">Hidden</Badge>}
        {action.pending && <Badge variant="warning">Running</Badge>}
        {action.href && <Badge variant="secondary">{action.href}</Badge>}
      </div>
      {action.groups?.length ? (
        <span className="text-muted-foreground">
          Groups: {action.groups.map((group) => group.id).join(', ')}
        </span>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={input}
          placeholder="Input as JSON (optional)"
          aria-label={`Input for ${id}`}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button variant="outline" onClick={() => void run()}>
          Run
        </Button>
      </div>
      {outcome && (
        <p role="status" className="wrap-anywhere text-muted-foreground">
          {outcome}
        </p>
      )}
    </div>
  );
}

function Services({ module, runtime }: { module: InventoryPlugin; runtime: BitaKitRuntime }) {
  // Services form a tree: `todos.items` lives at services.todos.items.
  const services = new Proxy({} as Record<string, unknown>, {
    get: (_target, id) =>
      typeof id === 'string'
        ? id
            .split('.')
            .reduce<unknown>(
              (node, segment) => (node as Record<string, unknown> | undefined)?.[segment],
              runtime.services as unknown,
            )
        : undefined,
  });
  return (
    <Section
      title="Services"
      description="Instances this plugin provides and the methods other code can call."
    >
      <Rows
        empty="This plugin has no services."
        items={(module.declarations ?? [])
          .filter((item) => item.kind === 'service' && item.id)
          .map((service) => (
            <div key={service.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">services.{service.id}</span>
                <span className="text-muted-foreground">{service.id}</span>
              </div>
              <span className="wrap-anywhere text-muted-foreground">
                {runtime.isReady(module.id)
                  ? methods(services[service.id!]).join(', ') || 'No methods'
                  : 'Owner unavailable'}
              </span>
            </div>
          ))}
      />
    </Section>
  );
}

function Events({ runtime }: { runtime: BitaKitRuntime }) {
  const [events, setEvents] = useState<{ at: string; event: BitaKitEvent }[]>([]);
  useEffect(
    () =>
      runtime.events.observe((event) =>
        setEvents((current) =>
          [{ at: new Date().toLocaleTimeString(), event }, ...current].slice(0, 50),
        ),
      ),
    [runtime],
  );
  return (
    <Section title="Events" description="Events emitted while this page is open, newest first.">
      <Rows
        empty="No events yet. Use the plugin to see what it emits."
        items={events.map(({ at, event }) => (
          <div key={`${at}-${event.type}`} className="flex flex-wrap items-baseline gap-2">
            <span className="text-muted-foreground">{at}</span>
            <span className="font-medium">{event.type}</span>
            {event.data !== undefined && (
              <span className="wrap-anywhere text-muted-foreground">{format(event.data)}</span>
            )}
          </div>
        ))}
      />
      {events.length > 0 && (
        <Button variant="outline" className="self-start" onClick={() => setEvents([])}>
          Clear log
        </Button>
      )}
    </Section>
  );
}

function Configuration({ plugin }: { plugin: string }) {
  const inventory = useRuntimeInventory();
  const keys =
    inventory.static.plugins
      .find((item) => item.id === plugin)
      ?.declarations?.filter((item) => item.kind === 'config')
      .map((item) => item.id) ?? [];
  return (
    <Section
      title="Configuration"
      description="Declared configuration; values are omitted from the inventory."
    >
      {keys.length ? (
        <pre className="overflow-x-auto text-xs">
          {JSON.stringify({ declarations: keys, values: 'omitted' }, null, 2)}
        </pre>
      ) : (
        <p className="text-muted-foreground">This plugin has no configuration.</p>
      )}
    </Section>
  );
}

/** Public method names of a service instance, including class methods. */
function methods(instance: unknown): string[] {
  const names = new Set<string>();
  for (
    let target = instance;
    target && target !== Object.prototype;
    target = Object.getPrototypeOf(target)
  )
    for (const name of Object.getOwnPropertyNames(target))
      if (
        name !== 'constructor' &&
        typeof (instance as Record<string, unknown>)[name] === 'function'
      )
        names.add(name);
  return [...names];
}

function format(value: unknown) {
  try {
    const text = JSON.stringify(value);
    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  } catch {
    return String(value);
  }
}
