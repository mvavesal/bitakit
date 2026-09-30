import createNextIntlPlugin from 'next-intl/plugin';
import { withFoundation } from '@bitakit/next/config';
export default withFoundation(createNextIntlPlugin()({
  devIndicators: false,
  async rewrites() {
    const origin = process.env.FOUNDATION_AUTH_ORIGIN;
    return origin ? [{ source: '/api/auth/:path*', destination: `${origin}/api/auth/:path*` }] : [];
  },
}));

// Discovery includes plugin-owned page contributions.
