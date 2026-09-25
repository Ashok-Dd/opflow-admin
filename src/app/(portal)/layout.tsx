import { Nav, type NavGroup } from '@/components/nav';
import { can } from '@/lib/format';
import { me } from '@/lib/me';

import { signOut } from '../(auth)/actions';

export default async function PortalLayout({ children }: LayoutProps<'/'>) {
  const who = await me();
  const r = who.role;
  const groups: NavGroup[] = [
    {
      title: 'The day',
      items: [
        { href: '/', label: 'Today' },
        { href: '/attention', label: 'Needs attention' },
        { href: '/live', label: 'Live OPDs' },
        { href: '/emergency', label: 'Emergency' },
      ],
    },
    {
      title: 'Records',
      items: [
        ...(can(r, 'doctors') ? [{ href: '/doctors', label: 'Doctors' }] : []),
        { href: '/hospitals', label: 'Hospitals' },
      ],
    },
    ...(can(r, 'money') ? [{ title: 'Money', items: [{ href: '/money', label: 'Refunds & payouts' }] }] : []),
    {
      title: 'Settings',
      items: [
        { href: '/settings/rules', label: 'Rules & switches' },
      ],
    },
  ];

  return (
    <div className="frame">
      <aside className="index">
        <div className="mark">
          <b>OPflow</b>
          <span>ADMIN</span>
        </div>
        <Nav groups={groups} />
        <div className="who">
          <b>{who.name}</b>
          <span className="mono">{who.role}</span> · {who.email}
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="sheet">{children}</main>
    </div>
  );
}
