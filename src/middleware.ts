/**
 * Edge middleware — the first gate, before any route handler or query runs.
 *
 * It does three things only:
 *  1. rejects requests with a missing/invalid session on protected routes;
 *  2. bounces signed-in visitors out of the auth screens;
 *  3. marks API responses non-cacheable and tags them with a request id.
 *
 * Authorisation (role + row ownership) is enforced again inside the handlers,
 * because a token being valid is not the same as being allowed.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/token';
import { CAMPAIGN_COOKIE, campaignFromUrl, encodeCampaign } from '@/lib/marketing/attribution';

/** 30 days: long enough for a household decision, short enough not to stalk. */
const CAMPAIGN_TTL = 30 * 24 * 60 * 60;

const PROTECTED = [
  '/dashboard',
  '/properties',
  '/people',
  '/travel',
  '/lifestyle',
  '/vehicles',
  '/finance',
  '/documents',
  '/ai',
  '/briefing',
  '/settings',
  '/support',
  '/admin',
];

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

const PUBLIC_API = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/logout',
  '/api/access-requests',
  '/api/locale',
  '/api/health',
  '/api/billing/webhook',
];

function isProtected(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? '';
  const claims = token ? await verifySessionToken(token) : null;

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const isApi = pathname.startsWith('/api');

  const respond = (init?: { request?: NextRequest }) => {
    const response = init?.request ? NextResponse.next({ request: init.request }) : NextResponse.next();
    if (isApi) response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('X-Request-Id', requestId);
    if (process.env.NODE_ENV === 'production') {
      // Defence in depth alongside next.config headers().
      response.headers.set('X-Content-Type-Options', 'nosniff');
    }
    // A paid landing carries its own account statement in the URL. Freeze it here,
    // on the first page view, because the conversion happens on another URL later.
    if (!isApi && request.method === 'GET') {
      const campaign = campaignFromUrl(request.nextUrl);
      if (campaign) {
        response.cookies.set(CAMPAIGN_COOKIE, encodeCampaign(campaign), {
          path: '/', maxAge: CAMPAIGN_TTL, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
        });
      }
    }
    return response;
  };

  // API: reject anything that is not explicitly public.
  if (isApi) {
    if (!isProtected(pathname, PUBLIC_API) && !claims) {
      return NextResponse.json(
        { ok: false, error: { code: 'unauthenticated', message: 'A valid session is required.' } },
        { status: 401, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
      );
    }
    if (isProtected(pathname, ['/api/admin']) && claims?.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: { code: 'forbidden', message: 'Administrator access is required.' } },
        { status: 403, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } },
      );
    }
    return respond({ request });
  }

  if (isProtected(pathname, PROTECTED) && !claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + (search ?? ''))}`;
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set('X-Request-Id', requestId);
    return redirectResponse;
  }

  // Admin pages need the role claim, not just a session.
  if (pathname.startsWith('/admin') && claims && claims.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    const denied = NextResponse.redirect(url);
    denied.headers.set('X-Request-Id', requestId);
    return denied;
  }

  if (AUTH_PAGES.some((page) => pathname === page) && claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    const away = NextResponse.redirect(url);
    away.headers.set('X-Request-Id', requestId);
    return away;
  }

  return respond({ request });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|site.webmanifest|robots.txt).*)'],
};
