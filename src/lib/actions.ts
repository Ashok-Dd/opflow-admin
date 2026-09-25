import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import { api, ApiError, tokenOverride } from './api';
import { saveAccess } from './session';

/** What every form gets back. The page shows `message` or the error in place. */
export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; code: string; message: string; fields?: Record<string, string> }
  | null;

/**
 * Runs an admin action. If the API asks for a fresh authenticator code (verifying, refunds, reveals,
 * rules), the form shows a code box; when it comes back with `stepUpCode`, we re-verify first, then run.
 */
export async function runAction<T>(form: FormData, fn: () => Promise<{ message?: string; data?: T } | void>): Promise<ActionResult<T>> {
  try {
    const code = String(form.get('stepUpCode') ?? '').trim();
    let out: { message?: string; data?: T } | void;
    if (code) {
      const r = await api<{ accessToken: string; expiresIn: number }>('POST', '/v1/admin/auth/step-up', { body: { code } });
      await saveAccess(r.accessToken, r.expiresIn);
      out = await tokenOverride.run(r.accessToken, fn);
    } else {
      out = await fn();
    }
    out ??= {};
    return { ok: true, message: out.message, data: out.data };
  } catch (err) {
    unstable_rethrow(err); // let Next.js redirects through
    if (err instanceof ApiError) {
      const fields = (err.details?.fields as Record<string, string> | undefined) ?? undefined;
      return { ok: false, code: err.code, message: err.message, fields };
    }
    console.error(err);
    return { ok: false, code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
  }
}

export const str = (f: FormData, k: string): string => String(f.get(k) ?? '').trim();
export const optStr = (f: FormData, k: string): string | undefined => str(f, k) || undefined;
export const rupeesToPaise = (v: string): number => Math.round(Number(v.replace(/[₹,\s]/g, '')) * 100);
