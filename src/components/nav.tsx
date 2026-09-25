'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  count?: number;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** The index strip: numbered like a register. The current page is marked. */
export function Nav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const starts = groups.map((_, gi) => groups.slice(0, gi).reduce((a, g) => a + g.items.length, 0));
  return (
    <nav aria-label="Sections">
      {groups.map((g, gi) => (
        <div key={g.title}>
          <div className="group">{g.title}</div>
          {g.items.map((i, ii) => {
            const n = starts[gi]! + ii + 1;
            const active = i.href === '/' ? path === '/' : path === i.href || path.startsWith(`${i.href}/`);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
                <span className="no">{String(n).padStart(2, '0')}</span>
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
