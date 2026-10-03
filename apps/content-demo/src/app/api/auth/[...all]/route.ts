import { previewAuth } from '@/server/preview-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function handle(request: Request) {
  const auth = previewAuth();
  return auth
    ? auth.handler(request)
    : new Response('Configure the auth proxy or start the local preview.', { status: 503 });
}
export const GET = handle;
export const POST = handle;
