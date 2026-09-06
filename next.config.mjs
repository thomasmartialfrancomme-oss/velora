/** @type {import('next').NextConfig} */

/**
 * Hardened response headers are applied to any production build, and skipped
 * when the app is being embedded in preview/ops tooling (VELORA_ALLOW_FRAMING=1).
 * Rationale and the exact values: SECURITY.md § 8.
 */
const harden = process.env.NODE_ENV === 'production' && process.env.VELORA_ALLOW_FRAMING !== '1';

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  'img-src \'self\' data: blob:',
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Runs src/instrumentation.ts once when the server boots: it refuses to
    // start in production without a real AUTH_SECRET.
    instrumentationHook: true,
    // Native module: keep out of the server bundle so it loads at runtime.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  async headers() {
    const shared = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    if (!harden) {
      // Deliberately no X-Frame-Options and no CSP here: the sandbox proxy and
      // ops tooling embed the app cross-origin, and a strict policy would break
      // the live preview. Everything else still applies.
      return [{ source: '/:path*', headers: shared }];
    }
    return [
      {
        source: '/:path*',
        headers: [
          ...shared,
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
