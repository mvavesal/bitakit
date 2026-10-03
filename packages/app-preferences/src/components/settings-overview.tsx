'use client';
import { Suspense, useId } from 'react';
import { useSettingsCatalog } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import ChevronRightIcon from 'reicon-react/icons/ChevronRight';
import SearchIcon from 'reicon-react/icons/Search';
import { visibleSections } from '../catalog.js';
import { groupByCategory } from '../categories.js';
import { sectionHref } from '../paths.js';
import { searchSettings } from '../search.js';
import { iconOf } from './icon.js';
import { useSettingsLocation } from './location.js';
import { SearchField, useSettingsQuery } from './search-field.js';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './ui/empty.js';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from './ui/item.js';
import { useCategoryTitle, useMessages } from './use-messages.js';

export type SettingsOverviewProps = {
  basePath?: string;
  /**
   * Filters the list. Without it the overview reads and writes the `q` query parameter and
   * renders its own search field and reset button.
   */
  query?: string;
  /** Render the search field when the overview owns the query. Default: true. */
  showSearch?: boolean;
};

function Overview({
  basePath,
  query,
  showSearch,
  onQueryChange,
}: {
  basePath?: string;
  query: string;
  showSearch: boolean;
  onQueryChange?: (value: string | null) => void;
}) {
  const location = useSettingsLocation({ basePath });
  const messages = useMessages();
  const categoryTitle = useCategoryTitle();
  const id = useId();
  const results = searchSettings(visibleSections(useSettingsCatalog()), query);
  const groups = groupByCategory(results, (result) => result.section.category, categoryTitle);
  const { Link } = location;
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      {showSearch && (
        <SearchField
          showLabel
          label={messages('search')}
          placeholder={messages('searchPlaceholder')}
          clearLabel={messages('clearSearch')}
          value={query}
          onValueChange={onQueryChange}
        />
      )}
      <p role="status" className="sr-only">
        {messages('results', { count: results.length })}
      </p>
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${id}${group.id}`}
          className="flex min-w-0 flex-col gap-3"
        >
          <h2 id={`${id}${group.id}`} className="text-sm font-medium text-muted-foreground">
            {group.title}
          </h2>
          <ItemGroup>
            {group.items.map(({ section, fields }) => {
              const Icon = iconOf(section.icon);
              return (
                <div role="listitem" key={section.id} className="min-w-0">
                  <Item asChild variant="outline">
                    <Link href={sectionHref(location.basePath, section)}>
                      {Icon && (
                        <ItemMedia variant="icon">
                          <Icon aria-hidden="true" />
                        </ItemMedia>
                      )}
                      <ItemContent className="min-w-0">
                        <ItemTitle>{section.title}</ItemTitle>
                        {section.description && (
                          <ItemDescription>{section.description}</ItemDescription>
                        )}
                        {fields.length > 0 && (
                          <ItemDescription>
                            {fields.map((field) => field.label).join(' · ')}
                          </ItemDescription>
                        )}
                      </ItemContent>
                      <ChevronRightIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </section>
      ))}
      {!results.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{messages('noResults')}</EmptyTitle>
            <EmptyDescription>{messages('noResultsHint')}</EmptyDescription>
          </EmptyHeader>
          {onQueryChange && (
            <EmptyContent>
              <Button variant="outline" onClick={() => void onQueryChange(null)}>
                {messages('resetSearch')}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  );
}
function SearchableOverview(props: { basePath?: string; showSearch: boolean }) {
  const [query, setQuery] = useSettingsQuery();
  return <Overview {...props} query={query} onQueryChange={setQuery} />;
}

/** Every settings page with its fields by category, searchable, with an empty state. */
export function SettingsOverview({ basePath, query, showSearch = true }: SettingsOverviewProps) {
  if (query !== undefined) return <Overview basePath={basePath} query={query} showSearch={false} />;
  return (
    <Suspense fallback={<Overview basePath={basePath} query="" showSearch={false} />}>
      <SearchableOverview basePath={basePath} showSearch={showSearch} />
    </Suspense>
  );
}
