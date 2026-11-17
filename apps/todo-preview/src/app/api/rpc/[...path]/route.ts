import { fetchHandler } from '@bitakit/core/server';
import { server } from '@/bitakit.gen.server';

// Every BitaKit server operation the browser calls: POST /api/rpc/<operation id>.
export const POST = fetchHandler(server);
