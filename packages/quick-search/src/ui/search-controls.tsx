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
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import type { RegisteredSource } from '../types.js';

/** Narrow enabled sources for this dialog; persistent source choices belong to Settings. */
export function SearchControls({
  sources,
  category,
  setCategory,
}: {
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
    <div
      className="quick-search-controls flex items-center px-2 py-1"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') event.stopPropagation();
      }}
    >
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
            <ChevronDownIcon aria-hidden="true" />
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
    </div>
  );
}
