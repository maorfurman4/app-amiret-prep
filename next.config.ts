import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [{
      urlPattern: ({ url, sameOrigin }) => (sameOrigin && url.pathname.startsWith('/api/')) || url.hostname.endsWith('.supabase.co'),
      handler: 'NetworkOnly',
      options: { cacheName: 'apis' },
    }],
  },
});

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
};

export default withPWA(nextConfig);
