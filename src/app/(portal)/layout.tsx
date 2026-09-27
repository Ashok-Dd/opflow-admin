import type { NavGroup } from '@/components/nav';
import { Shell } from '@/components/shell';
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
        ...(can(r, 'addDoctor') ? [{ href: '/picks', label: 'Doctor picks' }] : []),
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
    <Shell groups={groups} who={{ name: who.name, email: who.email, role: who.role }} signOut={signOut}>
      {children}
    </Shell>
  );
}
