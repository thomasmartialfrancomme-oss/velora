/**
 * Server boot hook (Next 14 `instrumentationHook`).
 *
 * Its only job is to fail loudly and immediately when a production process is
 * missing a real signing secret: a silently-generated secret would make every
 * session forgeable by anyone who could read the repository.
 *
 * Two deliberate constraints:
 *  · no imports. This file is bundled for both the Node server and the Edge
 *    middleware, and `@/lib/config` pulls in `node:path`;
 *  · skipped during `next build`, which runs with NODE_ENV=production and would
 *    otherwise refuse to compile a preview build.
 *
 * The same rule, shared with the rest of the app, lives in
 * `assertProductionSecret()` in src/lib/config.ts.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error(
      'AUTH_SECRET is required in production (min 32 chars). Generate one with `openssl rand -base64 48`.',
    );
  }
}
