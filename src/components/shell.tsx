'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Nav, type NavGroup } from './nav';

/**
 * The page frame: a green sidebar on wide screens. On phones and small tablets the sidebar is hidden behind a
 * ☰ button in a top bar; it slides in over the page and closes on a tap outside, on Escape, or after picking a page.
 */
export function Shell({
  groups,
  who,
  signOut,
  children,
}: {
  groups: NavGroup[];
  who: { name: string; email: string; role: string };
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname();
  // The menu is open on the page where ☰ was tapped; going to another page closes it by itself.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);

  // On phones, table rows show as cards: each cell gets its column name (from the table's headings) as a label.
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>('table.register').forEach((t) => {
        const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '');
        t.querySelectorAll('tbody tr').forEach((tr) => {
          [...tr.children].forEach((td, i) => {
            if (heads[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]!);
          });
        });
      });
    };
    label();
    const main = document.querySelector('main.sheet');
    if (!main) return;
    const watch = new MutationObserver(label);
    watch.observe(main, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className={`frame${open ? ' menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="burger" aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="brand">
          <b>OPflow</b>
          <span>ADMIN</span>
        </div>
      </header>

      <aside id="sidebar" className="index" aria-label="Menu">
        <div className="mark">
          <div className="brand">
            <b>OPflow</b>
            <span>ADMIN</span>
          </div>
          <button type="button" className="close" aria-label="Close menu" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Nav groups={groups} />
        <div className="who">
          <div className="avatar" aria-hidden="true">{who.name.trim().charAt(0).toUpperCase() || 'A'}</div>
          <div className="who-text">
            <b>{who.name}</b>
            <span>{who.email}</span>
          </div>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <main className="sheet">{children}</main>
    </div>
  );
}
