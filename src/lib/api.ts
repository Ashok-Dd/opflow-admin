import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';

import { accessToken } from './session';

/** A token just issued in this request (after a step-up), used instead of the cookie for the rest of it. */
export const tokenOverride = new AsyncLocalStorage<string>();

export const API_BASE = (process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** The API's one error shape, in simple English, ready to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface CallOptions {
  body?: unknown;
  query?: Query;
  /** Writes that must never happen twice get an Idempotency-Key (safe to retry). */
  idempotent?: boolean;
  /** Public endpoints (sign-in, setup) don't send the session. */
  anonymous?: boolean;
  token?: string;
}

/**
 * Calls the OPflow API from the server. A missing/expired session sends the admin to sign in
 * (the proxy normally refreshes it first, so this is rare).
 */
export async function api<T = unknown>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.idempotent) headers['idempotency-key'] = randomUUID();
  const token = opts.anonymous ? undefined : (opts.token ?? tokenOverride.getStore() ?? (await accessToken()));
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(503, 'API_UNREACHABLE', 'The OPflow server cannot be reached right now. Please try again in a minute.');
  }
  if (res.status === 401 && !opts.anonymous) redirect('/sign-in?expired=1');
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const body = type.includes('json') ? ((await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } }) : {};
    throw new ApiError(res.status, body.error?.code ?? 'ERROR', body.error?.message ?? 'Something went wrong. Please try again.', body.error?.details);
  }
  if (type.includes('json')) return (await res.json()) as T;
  return (await res.text()) as T;
}

export const get = <T>(path: string, query?: Query) => api<T>('GET', path, { query });

/** For pages: returns data, or the error to show in place (never crashes the page). */
export async function load<T>(path: string, query?: Query): Promise<{ data: T; error: null } | { data: null; error: ApiError }> {
  try {
    return { data: await get<T>(path, query), error: null };
  } catch (err) {
    if (err instanceof ApiError) return { data: null, error: err };
    throw err; // redirects etc.
  }
}
