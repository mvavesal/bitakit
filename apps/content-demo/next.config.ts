import createNextIntlPlugin from 'next-intl/plugin';
import { withBitaKit } from '@bitakit/next/config';
// Discovery generates src/bitakit.gen.* before Next starts and keeps it current in development.
export default withBitaKit(
  createNextIntlPlugin()({
    devIndicators: false,
    async rewrites() {
      const origin = process.env.FOUNDATION_AUTH_ORIGIN;
      return {
        beforeFiles:
          origin && process.env.CONTENT_DEMO_AUTH !== 'memory'
            ? [{ source: '/api/auth/:path*', destination: `${origin}/api/auth/:path*` }]
            : [],
      };
    },
  }),
);
