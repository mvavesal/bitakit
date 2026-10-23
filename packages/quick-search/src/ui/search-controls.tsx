'use client';
import { useTranslation } from '@bitakit/ui';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@bitakit/ui/components';
import { useSearchText } from './use-sources.js';
import type { RegisteredSource } from '../types.js';

/** Category selection lasts for this dialog only; source switches are persisted preferences. */
export function SearchControls({
  sources,
  category,
  setCategory,
  expanded,
  setExpanded,
}: {
  expanded: boolean;
  setExpanded(value: boolean): void;
  sources: readonly RegisteredSource[];
  category: string | null;
  setCategory(value: string | null): void;
}) {
  const t = useTranslation();
  const text = useSearchText();
  const categories = [
    ...new Map(sources.map(({ source }) => [source.category.id, source.category])).values(),
  ];
  const selected = categories.find((item) => item.id === category);
  return (
    <div className="quick-search-controls" onKeyDown={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-2 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('quickSearch.filter', undefined, 'Filter by category')}
            >
              {selected
                ? text(selected.title)
                : t('quickSearch.allCategories', undefined, 'All categories')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="quick-search-category-menu">
            <DropdownMenuRadioGroup
              value={category ?? ''}
              onValueChange={(value) => setCategory(value || null)}
            >
              <DropdownMenuRadioItem value="">
                {t('quickSearch.allCategories', undefined, 'All categories')}
              </DropdownMenuRadioItem>
              {categories.map((item) => (
                <DropdownMenuRadioItem key={item.id} value={item.id}>
                  {text(item.title)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {t('quickSearch.sourceSettings', undefined, 'Search sources')}
        </Button>
      </div>
    </div>
  );
}
