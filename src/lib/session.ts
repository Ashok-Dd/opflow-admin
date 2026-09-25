import 'server-only';

import { cookies } from 'next/headers';

/**
 * The admin's session lives only in httpOnly, SameSite=strict cookies. The browser never sees a token in
 * JavaScript and never talks to the API directly: pages and actions call the API from the server.
 */
export const ACCESS = 'opf_at';
export const REFRESH = 'opf_rt';
export const MFA = 'opf_mfa';

export const secure = process.env.NODE_ENV === 'production';

export const cookieBase = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Seconds until the JWT expires (no signature check here: the API checks every request). */
export function tokenSecondsLeft(token: string | undefined): number {
  if (!token) return -1;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    return (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

export function tokenClaims(token: string | undefined): { sub?: string; role?: string; su?: number } {
  try {
    return JSON.parse(Buffer.from((token ?? '').split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

/** Only in Server Actions / Route Handlers (cookies can't be written while a page renders). */
export async function saveSession(pair: TokenPair): Promise<void> {
  const jar = await cookies();
  jar.set(ACCESS, pair.accessToken, { ...cookieBase, maxAge: pair.expiresIn });
  // The API ends the session after 8 hours, or 30 minutes without activity; the cookie just carries it.
  jar.set(REFRESH, pair.refreshToken, { ...cookieBase, maxAge: 8 * 3600 });
}

export async function saveAccess(accessToken: string, expiresIn: number): Promise<void> {
  (await cookies()).set(ACCESS, accessToken, { ...cookieBase, maxAge: expiresIn });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
  jar.delete(MFA);
}

export async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS)?.value;
}
