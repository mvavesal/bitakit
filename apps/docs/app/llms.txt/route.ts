import { docsLlms } from '@/lib/source';

export const revalidate = false;
export const dynamic = 'force-static';

export async function GET() {
  const markdown = await docsLlms.index();
  return new Response(
    markdown.replaceAll('](/docs', `](${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/docs`),
  );
}
