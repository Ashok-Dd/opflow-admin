import Link from 'next/link';
import { Empty, Head, LoadError, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { can, day, rupees } from '@/lib/format';
import { me } from '@/lib/me';

export const metadata = { title: 'Doctors' };

interface DoctorRow {
  id: string;
  name: string;
  typeName: string;
  verification: string;
  status: string;
  feePaise: number;
  loginId: string | null;
  phone: string | null;
  hospitals: string[] | null;
  lastOpd: string | null;
  payoutStatus: string | null;
  createdAt: string;
}

export default async function DoctorsPage({ searchParams }: PageProps<'/doctors'>) {
  const q = sp(await searchParams);
  const [who, list] = await Promise.all([
    me(),
    load<DoctorRow[]>('/v1/admin/doctors', { q: q.q, verification: q.verification, status: q.status, limit: 50 }),
  ]);
  return (
    <>
      <Head kicker="Only the OPflow team adds doctors" title="Doctors" lead="A new doctor is hidden from patients until you verify them.">
        {can(who.role, 'addDoctor') ? <Link className="btn" href="/doctors/new">Add a doctor</Link> : null}
      </Head>
      <form className="filters">
        <label className="field grow">
          <span>Search</span>
          <input name="q" defaultValue={q.q} placeholder="Name, OPD-… login ID, mobile or registration number" />
        </label>
        <label className="field">
          <span>Verification</span>
          <select name="verification" defaultValue={q.verification ?? ''}>
            <option value="">Any</option>
            <option value="pending">Waiting</option>
            <option value="needs_correction">Needs correction</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={q.status ?? ''}>
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <button className="btn ghost">Show</button>
      </form>
      {list.error ? <LoadError error={list.error} /> : null}
      {list.data && list.data.length === 0 ? <Empty title="No doctors match." /> : null}
      {list.data && list.data.length > 0 ? (
        <table className="register">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Login</th>
              <th>Hospitals</th>
              <th className="num">Fee</th>
              <th>Verification</th>
              <th>Payout</th>
              <th>Last OPD</th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((d) => (
              <tr key={d.id}>
                <td>
                  <a className="rowlink" href={`/doctors/${d.id}`}>{d.name}</a>
                  <span className="sub">{d.typeName} · {d.phone ?? 'no phone'}</span>
                </td>
                <td className="mono">{d.loginId ?? '—'}</td>
                <td className="muted">{(d.hospitals ?? []).join(', ') || '—'}</td>
                <td className="num">{rupees(d.feePaise)}</td>
                <td>
                  <Stamp s={d.status === 'suspended' ? 'suspended' : d.verification} />
                </td>
                <td><Stamp s={d.payoutStatus ?? 'pending'} /></td>
                <td className="muted">{d.lastOpd ? day(d.lastOpd) : 'none yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
