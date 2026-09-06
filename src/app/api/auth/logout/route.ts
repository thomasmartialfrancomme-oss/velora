/** POST /api/auth/logout — clears the cookie. Returns 200 whether or not a session existed. */
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';
import { audit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true, data: { signedOut: true } });
  response.cookies.delete('velora_session');
  void request;
  audit({ userId: null, event: 'session.sign_out' });
  return response;
}
