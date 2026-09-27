'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  count?: number;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

const I = (d: string): ReactNode => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** One small line icon per section (same stroke style throughout). */
const ICONS: Record<string, ReactNode> = {
  '/': I('M4 5h16v15H4zM4 10h16M9 3v4M15 3v4'),
  '/attention': I('M12 4l9 16H3zM12 10v4M12 17.5v.5'),
  '/live': I('M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v8'),
  '/emergency': I('M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z'),
  '/doctors': I('M6 4v5a4 4 0 0 0 8 0V4M10 13v2a5 5 0 0 0 10 0v-2M20 11.5a1.5 1.5 0 1 1 0 .1'),
  '/hospitals': I('M4 20V8l8-4 8 4v12M9 20v-5h6v5M12 8v4M10 10h4'),
  '/picks': I('M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z'),
  '/money': I('M3 7h18v12H3zM3 11h18M16 15h2'),
  '/settings/rules': I('M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4'),
};

/** The sidebar menu. The current page is highlighted. */
export function Nav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Sections">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="group">{g.title}</div>
          {g.items.map((i) => {
            const active = i.href === '/' ? path === '/' : path === i.href || path.startsWith(`${i.href}/`);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
                <span className="ico">{ICONS[i.href] ?? I('M5 12h14')}</span>
                <span>{i.label}</span>
                {i.count ? <span className="count">{i.count}</span> : <span />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
