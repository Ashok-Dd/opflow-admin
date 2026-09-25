import Link from 'next/link';
import { Empty, Head, LoadError, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { can } from '@/lib/format';
import { me } from '@/lib/me';

export const metadata = { title: 'Hospitals' };

interface H {
  id: string;
  name: string;
  area: string;
  city: string;
  phone: string;
  hasEmergency: boolean;
  departments: string[];
  doctorCount: number;
  status?: string;
}

export default async function HospitalsPage({ searchParams }: PageProps<'/hospitals'>) {
  const q = sp(await searchParams);
  const [who, list] = await Promise.all([me(), load<{ items: H[] }>('/v1/admin/hospitals', { q: q.q, limit: 50 })]);
  return (
    <>
      <Head kicker="Records" title="Hospitals" lead="Where doctors sit. Departments decide which types of doctor patients can find here.">
        {can(who.role, 'editHospitals') ? <Link className="btn" href="/hospitals/new">Add a hospital</Link> : null}
      </Head>
      <form className="filters">
        <label className="field grow"><span>Search</span><input name="q" defaultValue={q.q} placeholder="Name, area, city or PIN" /></label>
        <button className="btn ghost">Show</button>
      </form>
      {list.error ? <LoadError error={list.error} /> : null}
      {list.data?.items.length === 0 ? <Empty title="No hospitals yet." /> : null}
      {list.data && list.data.items.length > 0 ? (
        <table className="register">
          <thead><tr><th>Hospital</th><th>Phone</th><th className="num">Verified doctors</th><th>Emergency</th><th>Departments</th><th>Shown</th></tr></thead>
          <tbody>
            {list.data.items.map((h) => (
              <tr key={h.id}>
                <td><a className="rowlink" href={`/hospitals/${h.id}`}>{h.name}</a><span className="sub">{h.area}, {h.city}</span></td>
                <td className="mono">{h.phone}</td>
                <td className="num">{h.doctorCount}</td>
                <td>{h.hasEmergency ? <Stamp s="active" label="24 h" /> : <span className="faint">—</span>}</td>
                <td className="muted">{h.departments.join(', ')}</td>
                <td><Stamp s={h.status ?? 'active'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
