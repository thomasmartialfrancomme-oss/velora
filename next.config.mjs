/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Native module: keep out of the server bundle so it loads at runtime.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // NOTE: frame + CSP hardening is intentionally left out of the dev profile so the
  // app can be embedded in preview/ops tooling. See SECURITY.md for the production set.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
