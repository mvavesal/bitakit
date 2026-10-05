'use client';

import { File, Files, Folder } from 'fumadocs-ui/components/files';
import FileIcon from 'reicon-react/icons/File';

/** Browse authored examples; Fumadocs owns folder expansion and code stays read-only. */
export function SourceTree({
  files,
  selected,
  onSelect,
  controls,
}: {
  files: readonly string[];
  selected: string;
  onSelect?: (file: string) => void;
  controls: string;
}) {
  const uniqueFiles = [...new Set([...files, selected])];

  function entries(paths: string[], parent = '') {
    const names = [...new Set(paths.map((path) => path.split('/')[0]))];
    return names.map((name) => {
      const path = parent ? `${parent}/${name}` : name;
      const children = paths.filter((item) => item.startsWith(`${name}/`));
      if (children.length) {
        return (
          <Folder
            key={path}
            name={name}
            defaultOpen={selected.startsWith(`${path}/`)}
            className="[&>div[data-open]]:h-auto"
          >
            {entries(
              children.map((item) => item.slice(name.length + 1)),
              path,
            )}
          </Folder>
        );
      }
      return (
        <File
          key={path}
          name={name}
          icon={<FileIcon aria-hidden="true" />}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          aria-controls={onSelect ? controls : undefined}
          aria-current={path === selected ? 'true' : undefined}
          onClick={onSelect ? () => onSelect(path) : undefined}
          onKeyDown={
            onSelect
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(path);
                  }
                }
              : undefined
          }
          className={`${path === selected ? 'bg-fd-primary/10 font-medium text-fd-foreground' : ''} ${onSelect ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring' : ''}`}
        />
      );
    });
  }

  return (
    <div aria-label="Example file structure" role="group" className="flex h-64 min-h-0 min-w-0 flex-col gap-2 md:h-full">
      <p className="text-xs font-medium text-fd-muted-foreground">
        Files · choose one to view its code
      </p>
      <Files
        role="region"
        aria-label="Example files"
        tabIndex={0}
        className="fd-scroll-container min-h-0 flex-1 overflow-auto overscroll-contain border-0 bg-transparent p-1 focus-visible:outline-2 focus-visible:outline-fd-ring"
      >
        {entries(uniqueFiles)}
      </Files>
      <p className="text-xs text-fd-muted-foreground">
        {uniqueFiles.length} example {uniqueFiles.length === 1 ? 'file' : 'files'} · read-only
      </p>
    </div>
  );
}
