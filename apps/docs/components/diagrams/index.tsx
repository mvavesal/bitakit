import { renderMermaidSVG } from 'beautiful-mermaid';
import { charts } from './charts.mjs';

export function ArchitectureIllustration() {
  const description =
    'Your feature plugins and optional BitaKit plugins share headless Core. Pages bind through BitaKit UI; discovery generates imports and types at build time.';
  return (
    <figure data-doc-architecture="">
      <img
        className="dark:hidden"
        src="/diagrams/architecture-light.svg"
        width="880"
        height="472"
        alt={description}
      />
      <img
        className="hidden dark:block"
        src="/diagrams/architecture-dark.svg"
        width="880"
        height="472"
        alt={description}
      />
      <figcaption>
        Core owns execution and values; visual plugins provide UI. Preferences is the
        @bitakit/app-preferences package. TanStack Start support remains experimental.
      </figcaption>
    </figure>
  );
}

// Fumadocs' documented server renderer; only reviewed, committed chart sources are accepted.
export function Diagram({ name }: { name: keyof typeof charts }) {
  const { title, caption, chart } = charts[name];
  const svg = renderMermaidSVG(chart, {
    bg: 'var(--color-fd-background)',
    fg: 'var(--color-fd-foreground)',
    font: 'inherit',
    padding: 16,
    transparent: true,
  });

  return (
    <figure className="not-prose my-8 min-w-0 space-y-3" data-doc-diagram={name}>
      <p className="font-medium">{title}</p>
      <div
        role="img"
        tabIndex={0}
        aria-label={`${title}. ${caption}`}
        className="overflow-x-auto rounded-xl border border-fd-border bg-fd-card focus-visible:outline-2 focus-visible:outline-fd-ring [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-none"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-xs text-fd-muted-foreground sm:hidden">
        If the diagram is wider than the screen, swipe or focus it and use the arrow keys.
      </p>
      <figcaption className="text-sm text-fd-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
