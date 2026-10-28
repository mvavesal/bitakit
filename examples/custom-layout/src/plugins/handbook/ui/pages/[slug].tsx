'use client';
import { PageHeader } from '@bitakit/ui/components';
import { chapters } from '../../chapters';

// Served at /handbook/<slug>.
export default function ChapterPage({ params }: { params: { slug: string } }) {
  const chapter = chapters.find((candidate) => candidate.slug === params.slug);
  if (!chapter)
    return <PageHeader title="Chapter not found" subtitle={`No chapter named ${params.slug}.`} />;
  return (
    <article className="flex flex-col gap-6">
      <PageHeader title={chapter.title} subtitle={chapter.summary} />
      <p>{chapter.body}</p>
    </article>
  );
}
