import { auth, seedPreview } from '../../../../server/auth';
async function handler(request: Request) {
  await seedPreview();
  return auth.handler(request);
}
export { handler as GET, handler as POST };
