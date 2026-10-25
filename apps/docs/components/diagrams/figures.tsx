// Documentation diagrams. Each one is drawn with the diagram-design skill in the BitaKit profile:
// the source is apps/docs/diagrams/<name>.html, `npm run diagrams` derives the dark variant and
// exports both SVGs to public/diagrams. figures.json holds each diagram's title, caption, size and
// the implementation files to review when the API it shows changes. Reuse a name on every page
// that needs it; never copy an SVG into a page.
import figures from './figures.json';

export type FigureName = keyof typeof figures;

export function Figure({ name }: { name: FigureName }) {
  const { title, caption, width, height } = figures[name];
  const alt = `${title}. ${caption}`;
  return (
    <figure className="not-prose my-8 min-w-0 space-y-3" data-doc-figure={name}>
      <p className="font-medium">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-fd-border">
        {/* Never below 75% of its size, so 12px labels stay at least 9px; narrow screens scroll. */}
        <img
          className="block h-auto w-full dark:hidden"
          style={{ minWidth: Math.round(width * 0.75) }}
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/diagrams/${name}-light.svg`}
          width={width}
          height={height}
          alt={alt}
        />
        <img
          className="hidden h-auto w-full dark:block"
          style={{ minWidth: Math.round(width * 0.75) }}
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/diagrams/${name}-dark.svg`}
          width={width}
          height={height}
          alt={alt}
        />
      </div>
      <figcaption className="text-sm text-fd-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
