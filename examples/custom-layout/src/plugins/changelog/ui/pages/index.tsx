'use client';
import {
  Badge,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';

const releases = [
  { version: '2.4', date: '2026-10-20', text: 'New chapter: Shipping work.' },
  { version: '2.3', date: '2026-09-02', text: 'Working hours now list core hours per time zone.' },
  { version: '2.2', date: '2026-07-14', text: 'The handbook moved to its own app.' },
];

// Served at /changelog: a second page in the same frame.
export default function ChangelogPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Changelog" subtitle="What changed in the handbook." />
      <ItemGroup>
        {releases.map((release) => (
          <Item key={release.version} variant="outline">
            <ItemContent>
              <ItemTitle>
                <Badge variant="secondary">{release.version}</Badge>
                {release.date}
              </ItemTitle>
              <ItemDescription>{release.text}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
