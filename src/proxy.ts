import { NextResponse, type NextRequest } from 'next/server';

const ACCESS = 'opf_at';
const REFRESH = 'opf_rt';
const API = (process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC = ['/sign-in', '/setup'];

function secondsLeft(token: string | undefined): number {
  if (!token) return -1;
  try {
    const json = atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json).exp ?? 0) - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

/**
 * Before each admin page: no session → sign in. Access token about to expire → swap the refresh token for a
 * new pair here (pages can't set cookies while rendering), so the page renders with a fresh token.
 * Every response is marked noindex and never cached.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const prefetch = request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';

  const harden = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };

  if (isPublic) return harden(NextResponse.next());

  if (!refresh) {
    const url = new URL('/sign-in', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return harden(NextResponse.redirect(url));
  }

  if (secondsLeft(access) > 180 || prefetch) return harden(NextResponse.next());

  try {
    const res = await fetch(`${API}/v1/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });
    if (res.ok) {
      const pair = (await res.json()) as { accessToken: string; refreshToken: string; expiresIn: number };
      // The page rendering now sees the new token too.
      request.cookies.set(ACCESS, pair.accessToken);
      request.cookies.set(REFRESH, pair.refreshToken);
      const out = NextResponse.next({ request: { headers: request.headers } });
      const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
      out.cookies.set(ACCESS, pair.accessToken, { ...opts, maxAge: pair.expiresIn });
      out.cookies.set(REFRESH, pair.refreshToken, { ...opts, maxAge: 8 * 3600 });
      return harden(out);
    }
    if (res.status === 401 && secondsLeft(access) <= 0) {
      const url = new URL('/sign-in', request.url);
      url.searchParams.set('expired', '1');
      url.searchParams.set('next', pathname + search);
      const out = NextResponse.redirect(url);
      out.cookies.delete(ACCESS);
      out.cookies.delete(REFRESH);
      return harden(out);
    }
  } catch {
    // API unreachable: let the page render; it shows "cannot reach the server" in place.
  }
  return harden(NextResponse.next());
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|robots.txt).*)'],
};
