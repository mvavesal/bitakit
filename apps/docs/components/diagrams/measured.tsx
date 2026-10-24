// Charts of the numbers in measurements.json, written by `npm run measure:onboarding -- --write`.
// The tables on the same page are the text view of these numbers.
import measurements from './measurements.json';

const format = (value: number) => value.toLocaleString('en-US');
const round = (value: number, step: number) => format(Math.round(value / step) * step);

/** Three headline numbers: what a plugin costs, what it runs on, what it changes elsewhere. */
export function MeasuredStats() {
  const plugins = measurements.workspace.map((row) => row.tokens);
  const stats = [
    {
      value: `${round(Math.min(...plugins), 10)}–${round(Math.max(...plugins), 10)}`,
      unit: 'tokens',
      label: 'per plugin in the Workspace sample, written by you or your agent',
    },
    {
      value: `≈${round(measurements.total.tokens, 1000)}`,
      unit: 'tokens',
      label: `of package code it runs on, covered by ${format(measurements.total.tests)} tests`,
    },
    { value: '0', unit: 'shared files', label: 'changed when a plugin extends another' },
  ];
  return (
    <dl className="not-prose my-8 grid gap-3 sm:grid-cols-3" data-doc-stats="">
      {stats.map((stat) => (
        // The label is the term; the value shows above it.
        <div
          key={stat.label}
          className="flex flex-col-reverse rounded-xl border border-fd-border bg-fd-card p-4"
        >
          <dt className="mt-1 text-sm text-fd-muted-foreground">{stat.label}</dt>
          <dd>
            <span className="text-3xl font-semibold tracking-tight">{stat.value}</span>{' '}
            <span className="text-sm text-fd-muted-foreground">{stat.unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

const roles: Record<string, string> = {
  notes: 'owns the feature',
  activity: 'feed and header count',
  export: 'one toolbar button',
  guard: 'two interceptors',
};

/** One bar per Workspace plugin: the tokens of its folder, in one hue with direct labels. */
export function PluginSizes() {
  const rows = [...measurements.workspace].sort((a, b) => b.tokens - a.tokens);
  const max = Math.max(...rows.map((row) => row.tokens));
  return (
    <figure className="not-prose my-8 space-y-3" data-doc-chart="plugin-sizes">
      <p className="font-medium">Tokens per plugin in the Workspace sample</p>
      <ul className="space-y-2 rounded-xl border border-fd-border bg-fd-card p-4">
        {rows.map((row) => (
          <li
            key={row.plugin}
            className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm"
            title={`${row.plugin}: ${format(row.tokens)} tokens in ${row.files} files`}
          >
            <span>
              <code>{row.plugin}</code>
              <span className="block text-xs text-fd-muted-foreground">{roles[row.plugin]}</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 rounded-r bg-fd-primary/70"
                style={{ width: `${(row.tokens / max) * 100}%`, minWidth: '0.5rem' }}
              />
              <span className="shrink-0 tabular-nums text-fd-muted-foreground">
                {format(row.tokens)} · {row.files} {row.files === 1 ? 'file' : 'files'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="text-sm text-fd-muted-foreground">
        Measured with the o200k tokenizer over each plugin folder. The three extensions are a few
        hundred tokens each; none of them edits the notes folder.
      </figcaption>
    </figure>
  );
}
