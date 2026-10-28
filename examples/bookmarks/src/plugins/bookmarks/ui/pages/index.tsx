'use client';
import { useState } from 'react';
import { Action, useServiceState, useSetting } from '@bitakit/ui';
import {
  Button,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';

// Served at /bookmarks. State comes from the bookmarks.list service; buttons run Actions.
export default function BookmarksPage() {
  const [url, setUrl] = useState('');
  const bookmarks = useServiceState('bookmarks.list', (state) => state.bookmarks, []);
  const status = useServiceState('bookmarks.list', (state) => state.status, 'loading');
  const error = useServiceState('bookmarks.list', (state) => state.error, '');
  const openInNewTab = useSetting('bookmarks.openInNewTab').value;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookmarks" subtitle="Saved in SQLite, loaded through an API route." />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={url}
          type="url"
          placeholder="https://example.com"
          aria-label="Link to save"
          onChange={(event) => setUrl(event.target.value)}
        />
        {/* Clear the field only when the bookmark was saved. */}
        <Action
          id="bookmarks.add"
          input={url}
          onExecuted={(result) => result.status === 'completed' && setUrl('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      {status === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : status === 'error' ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          Could not load bookmarks: {error}
          <Action id="bookmarks.reload">
            <Button variant="outline" size="sm" />
          </Action>
        </div>
      ) : bookmarks.length ? (
        <ItemGroup>
          {bookmarks.map((bookmark) => (
            <Item key={bookmark.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  <a
                    href={bookmark.url}
                    {...(openInNewTab ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {bookmark.title}
                  </a>
                </ItemTitle>
                <ItemDescription>{bookmark.url}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Action id="bookmarks.remove" input={bookmark.id}>
                  <Button variant="outline" size="sm" />
                </Action>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No bookmarks yet. Paste a link above.</p>
      )}
    </div>
  );
}
