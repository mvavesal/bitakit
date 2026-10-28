import { Badge } from '@bitakit/ui/components';

/**
 * The playground's groups of examples, numbered from the top. The tints live here only: the
 * theme's own colors are neutral, and the pills should tell the groups apart at a glance.
 */
export const groups = {
  live: { label: 'Live', first: 1, last: 1, tint: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  basics: {
    label: 'Basics',
    first: 2,
    last: 5,
    tint: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  running: {
    label: 'Running',
    first: 6,
    last: 9,
    tint: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  concurrency: {
    label: 'Concurrency',
    first: 10,
    last: 11,
    tint: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  controls: {
    label: 'Controls',
    first: 12,
    last: 16,
    tint: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
} as const;
export type Group = keyof typeof groups;

/** The pill above a card's title: its number and group. */
export function Pill({ n, group }: { n: number; group: Group }) {
  return (
    <Badge variant="outline" className={`border-transparent ${groups[group].tint}`}>
      Example {n} · {groups[group].label}
    </Badge>
  );
}

/** One pill per group under the page title; each jumps to the group's first card. */
export function GroupPills() {
  return (
    <nav aria-label="Example groups" className="flex flex-wrap gap-2">
      {Object.values(groups).map((group) => (
        <a key={group.label} href={`#example-${group.first}`}>
          <Badge variant="outline" className={`border-transparent ${group.tint}`}>
            {group.label} ·{' '}
            {group.first === group.last ? group.first : `${group.first}–${group.last}`}
          </Badge>
        </a>
      ))}
    </nav>
  );
}
