'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { type ActionResult, runAction, str } from '@/lib/actions';
import { api } from '@/lib/api';
import { clearSession, cookieBase, MFA, REFRESH, saveSession, type TokenPair } from '@/lib/session';

/** Only paths inside this site (never an open redirect). */
function safeNext(v: string): string {
  return /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) ? v : '/';
}

/** Step 1: email + password. The challenge for step 2 waits in a 5-minute httpOnly cookie. */
export async function signIn(_: ActionResult, form: FormData): Promise<ActionResult> {
  const next = safeNext(str(form, 'next') || '/');
  const r = await runAction(form, async () => {
    const res = await api<{ challengeToken: string }>('POST', '/v1/admin/auth/login', { anonymous: true, body: { email: str(form, 'email'), password: String(form.get('password') ?? '') } });
    (await cookies()).set(MFA, res.challengeToken, { ...cookieBase, maxAge: 300 });
  });
  if (r?.ok) redirect(`/sign-in/code?next=${encodeURIComponent(next)}`);
  return r;
}

/** Step 2: the authenticator code. */
export async function verifyCode(_: ActionResult, form: FormData): Promise<ActionResult> {
  const next = safeNext(str(form, 'next') || '/');
  const jar = await cookies();
  const challenge = jar.get(MFA)?.value;
  if (!challenge) return { ok: false, code: 'CHALLENGE_EXPIRED', message: 'This took too long. Please sign in again.' };
  const r = await runAction(form, async () => {
    const pair = await api<TokenPair>('POST', '/v1/admin/auth/totp', { anonymous: true, body: { challengeToken: challenge, code: str(form, 'code') } });
    await saveSession(pair);
    jar.delete(MFA);
  });
  if (r?.ok) redirect(next);
  return r;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  if (jar.get(REFRESH)) await api('POST', '/v1/admin/auth/logout').catch(() => undefined);
  await clearSession();
  redirect('/sign-in');
}

/** New admin: choose a password and prove the authenticator works. */
export async function completeSetup(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = str(form, 'token');
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('password2') ?? '')) return { ok: false, code: 'MISMATCH', message: 'The two passwords are not the same.' };
  const r = await runAction(form, async () => {
    await api('POST', `/v1/admin/auth/setup/${encodeURIComponent(token)}`, { anonymous: true, body: { password, code: str(form, 'code') } });
  });
  if (r?.ok) redirect('/sign-in?ready=1');
  return r;
}
