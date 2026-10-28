'use client';
import { useBitaKitNavigation } from '@bitakit/ui';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
} from '@bitakit/ui/components';
import { chapters } from '../../chapters';

// Served at /handbook. The frame around it comes from src/layouts/app.tsx, not from this page.
export default function HandbookPage() {
  const Link = useBitaKitNavigation().Link ?? 'a';
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Handbook" subtitle="How we work, one chapter per topic." />
      <ItemGroup>
        {chapters.map((chapter) => (
          <Item key={chapter.slug} variant="outline" asChild>
            <Link href={`/handbook/${chapter.slug}`}>
              <ItemContent>
                <ItemTitle>{chapter.title}</ItemTitle>
                <ItemDescription>{chapter.summary}</ItemDescription>
              </ItemContent>
            </Link>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
