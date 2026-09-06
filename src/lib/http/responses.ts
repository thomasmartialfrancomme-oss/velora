/** Uniform JSON envelopes so the client can always reason about a response. */
import { NextResponse } from 'next/server';
import { ZodError, type ZodIssue } from 'zod';
import { AuthError } from '@/lib/auth/session';
import { AlreadyExistsError, ConfirmationRequiredError, ConstraintError, OriginError } from '@/lib/errors';
import { NotFoundError } from '@/lib/db';

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    /** field → message, so forms can render inline errors */
    fields?: Record<string, string>;
  };
}

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, init: { status?: number; meta?: Record<string, unknown>; headers?: Record<string, string> } = {}) {
  const body: ApiSuccessBody<T> = { ok: true, data, ...(init.meta ? { meta: init.meta } : {}) };
  return NextResponse.json(body, { status: init.status ?? 200, headers: init.headers });
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return ok(data, { status: 201, meta });
}

export function fail(status: number, code: string, message: string, fields?: Record<string, string>) {
  const body: ApiErrorBody = { ok: false, error: { code, message, ...(fields ? { fields } : {}) } };
  return NextResponse.json(body, { status });
}

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * Every mutating handler is wrapped in this: unknown exceptions become a
 * readable 500 with no stack or SQL leaking to the browser, and the real error
 * stays in the server log.
 */
export function route<P extends Record<string, string> = Record<string, never>>(
  handler: (request: Request, ctx: { params: P }) => Promise<Response>,
) {
  return async (request: Request, ctx: { params: P }): Promise<Response> => {
    try {
      const res = await handler(request, ctx);
      if (request.method !== 'GET') res.headers.set('Cache-Control', 'no-store');
      return res;
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues as ZodIssue[]) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) fields[key] = issueMessage(issue);
    }
    return fail(422, 'validation_failed', 'Some fields need your attention.', fields);
  }
  if (error instanceof AuthError) return fail(error.status, error.status === 401 ? 'unauthenticated' : 'forbidden', error.message);
  if (error instanceof NotFoundError) return fail(404, 'not_found', error.message);
  if (error instanceof AlreadyExistsError) return fail(409, 'already_exists', error.message);
  if (error instanceof ConstraintError) return fail(400, 'constraint_failed', error.message);
  if (error instanceof OriginError) return fail(403, 'origin_rejected', error.message);
  if (error instanceof ConfirmationRequiredError) return fail(409, 'requires_confirmation', error.message);
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { ok: false, error: { code: 'rate_limited', message: error.message } } satisfies ApiErrorBody,
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof SyntaxError) return fail(400, 'malformed_request', 'The request body could not be read as JSON.');

  console.error('[velora] unhandled API error:', error);
  return fail(500, 'internal_error', 'Something went wrong on our side. The private office has been notified.');
}

function issueMessage(issue: { code: string; message: string; path: (string | number)[] }): string {
  if (issue.code === 'invalid_type' && issue.message.includes('undefined')) return 'This field is required.';
  return issue.message;
}

export { AlreadyExistsError, ConstraintError, ConfirmationRequiredError } from '@/lib/errors';
export class RateLimitError extends Error {
  name = 'RateLimitError';
  constructor(public retryAfterSeconds: number, message = 'Too many requests. Please wait a moment.') {
    super(message);
  }
}

export const cacheNoStore = NO_STORE;
