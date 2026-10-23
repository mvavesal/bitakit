'use client';
import { useTranslation } from '@bitakit/ui';
import {
  Button,
  FieldDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@bitakit/ui/components';
import { useSearchText } from './use-sources.js';
import { SourcePreferences } from './source-preferences.js';
import ChevronDownIcon from 'reicon-react/icons/ChevronDown';
import type { RegisteredSource } from '../types.js';

/** Category selection lasts for this dialog only; source switches are persisted preferences. */
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
      className="quick-search-controls flex flex-col gap-3 p-3"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') event.stopPropagation();
      }}
    >
      <SourcePreferences presentation="buttons" />
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('quickSearch.filter', undefined, 'Filter by category')}
            >
              {t('quickSearch.category', undefined, 'Category')}:{' '}
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
        <FieldDescription>
          {t('quickSearch.categoryHint', undefined, 'This search only')}
        </FieldDescription>
      </div>
    </div>
  );
}
