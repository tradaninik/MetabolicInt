/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mi/engine', '@mi/food-db'],
  experimental: {
    // PWA support will be wired via a custom manifest + service worker (no extra plugin
    // dependency to keep install lean and stable on Next 15 / React 19).
  },
  // P6-b: /coach lives inside /insights now ("Ask coach" pane). Route-level
  // redirect keeps old links and bookmarks working; not permanent so the
  // mapping can change again without browser caching fights.
  async redirects() {
    return [{ source: '/coach', destination: '/insights', permanent: false }];
  },
};

export default nextConfig;
