import type { ReactNode } from 'react';

import { ApiError } from '@/lib/api';
import { tone, words } from '@/lib/format';

export function Head({ kicker, title, lead, children }: { kicker?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="head">
      <div className="row">
        <div>
          {kicker ? <div className="kicker">{kicker}</div> : null}
          <h1>{title}</h1>
          {lead ? <p>{lead}</p> : null}
        </div>
        {children ? <div className="actions">{children}</div> : null}
      </div>
    </header>
  );
}

export function Stamp({ s, label }: { s: string | null | undefined; label?: string }) {
  return <span className={`stamp ${tone(s)}`}>{label ?? words(s)}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

/** Shown in place of a section whose data could not be loaded (the rest of the page still works). */
export function LoadError({ error }: { error: ApiError }) {
  return (
    <div className={`notice ${error.status === 403 ? 'warn' : 'bad'}`}>
      {error.status === 403 ? 'Your admin role cannot see this.' : error.message}
    </div>
  );
}

export function Sec({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <h2 className="sec">
      {title}
      {note ? <small>{note}</small> : null}
      {children}
    </h2>
  );
}

export function Pager({ nextCursor, cursor, base }: { nextCursor?: string | null; cursor?: string; base: URLSearchParams }) {
  if (!nextCursor && !cursor) return null;
  const next = new URLSearchParams(base);
  if (nextCursor) next.set('cursor', nextCursor);
  const first = new URLSearchParams(base);
  first.delete('cursor');
  return (
    <div className="pager">
      {cursor ? <a className="btn ghost small" href={`?${first}`}>← First page</a> : <span />}
      {nextCursor ? <a className="btn ghost small" href={`?${next}`}>Next page →</a> : null}
    </div>
  );
}

/** Next.js searchParams → a plain string map. */
export function sp(v: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? (x[0] ?? '') : (x ?? '')]).filter(([, x]) => x !== ''));
}
