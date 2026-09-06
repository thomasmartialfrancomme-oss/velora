/**
 * The API surface in one function.
 *
 * Every route is built with `api({ ... })`, which enforces — in this order:
 *   method/origin (CSRF) → rate limit → authentication → authorisation →
 *   schema validation → handler → uniform envelope → error mapping.
 * A handler therefore never has to remember a security step, and cannot
 * accidentally skip one.
 */
import type { NextRequest } from 'next/server';
import type { ZodTypeAny } from 'zod';
import { ok, route, toErrorResponse, fail, type ApiSuccessBody } from '@/lib/http/responses';
import { assertSameOrigin, clientIp, hashIp, rateLimitByIp } from '@/lib/http/security';
import { requireApiAdmin, requireApiUser, type SessionUser } from '@/lib/auth/session';
import { audit, NotFoundError } from '@/lib/db';

export type Auth = 'user' | 'admin' | 'public';

export interface ApiOptions<P extends Record<string, string>> {
  scope: string;
  auth?: Auth;
  schema?: ZodTypeAny;
  /** per-IP budget for this scope; defaults to the global window */
  limit?: { max: number; windowMs: number };
  idempotentGet?: boolean;
  handler: (input: {
    request: NextRequest;
    user: SessionUser;
    body: Record<string, unknown>;
    params: P;
    ip: string;
    ipHash: string;
  }) => unknown | Promise<unknown>;
}

export function api<P extends Record<string, string> = Record<string, never>>(options: ApiOptions<P>) {
  const handler = async (request: NextRequest, context: { params: P }): Promise<Response> => {
    const auth: Auth = options.auth ?? 'user';
    const ip = clientIp(request);
    const ipHash = hashIp(ip);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        assertSameOrigin(request);
      } catch (error) {
        return toErrorResponse(error);
      }
    }

    try {
      rateLimitByIp(request, `${options.scope}:${auth === 'public' ? 'public' : ip}`, options.limit?.max, options.limit?.windowMs);
    } catch (error) {
      return toErrorResponse(error);
    }

    let user: SessionUser;
    try {
      user = auth === 'admin' ? await requireApiAdmin() : auth === 'user' ? await requireApiUser() : ({} as SessionUser);
    } catch (error) {
      return toErrorResponse(error);
    }

    let body: Record<string, unknown> = {};
    if (options.schema && request.method !== 'GET') {
      let raw: unknown = {};
      try {
        raw = await request.json();
      } catch {
        raw = {};
      }
      const parsed = options.schema.safeParse(raw);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join('.') || 'form';
          if (!fields[key]) fields[key] = issue.message;
        }
        return fail(422, 'validation_failed', 'Some fields need your attention.', fields);
      }
      body = parsed.data as Record<string, unknown>;
    }

    try {
      const result = await options.handler({ request, user, body, params: context.params, ip, ipHash });
      if (result instanceof Response) return result;
      return ok(result as NonNullable<unknown>);
    } catch (error) {
      if (error instanceof NotFoundError) return fail(404, 'not_found', error.message);
      return toErrorResponse(error);
    }
  };

  // `route()` keeps unexpected failures out of the browser response.
  return route(handler as never) as unknown as (request: NextRequest, context: { params: P }) => Promise<Response>;
}

/** Convenience: a 501-shaped response with an honest message for unwired integrations. */
export function notConfigured(feature: string, whatIsNeeded: string): Response {
  return fail(501, 'not_configured', `${feature} is not connected in this build. ${whatIsNeeded}`);
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = (await request.json()) as unknown;
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function searchParam(request: NextRequest, key: string): string | undefined {
  const value = request.nextUrl.searchParams.get(key);
  return value && value.length ? value.slice(0, 120) : undefined;
}

export function auditAction(userId: string, event: string, target?: string, meta?: unknown): void {
  audit({ userId, event, target, meta });
}
