/**
 * GET /api/health — unauthenticated, non-sensitive.
 * Reports which integrations are live so an operator (or a demo audience)
 * never has to guess what is wired. No counts of user data are exposed.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { getDb } from '@/lib/db';
import { getBillingStatus } from '@/lib/billing';
import { activeProviderInfo } from '@/lib/ai/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database = 'unknown';
  try {
    getDb().get(`SELECT 1 AS one`);
    database = 'ok';
  } catch {
    database = 'error';
  }
  return NextResponse.json({
    ok: database === 'ok',
    service: 'velora-private',
    time: new Date().toISOString(),
    environment: env.isProduction ? 'production' : 'development',
    integrations: {
      database,
      billing: getBillingStatus(),
      ai: { provider: activeProviderInfo().id, external: activeProviderInfo().external, configured: env.capabilities.aiProviderConfigured },
      email: { configured: env.capabilities.smtpConfigured, note: env.capabilities.smtpConfigured ? 'SMTP transport configured' : 'No SMTP transport — reset links are logged instead' },
    },
  });
}
