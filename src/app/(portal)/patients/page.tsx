import { Empty, Head, LoadError, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { day } from '@/lib/format';

export const metadata = { title: 'Patients' };

export default async function PatientsPage({ searchParams }: PageProps<'/patients'>) {
  const q = sp(await searchParams);
  const phone = q.phone ? `+91${q.phone.replace(/\D/g, '').slice(-10)}` : undefined;
  const r = phone || q.code ? await load<{ id: string; phone: string | null; status: string; createdAt: string; name: string | null; birthYear: number | null; gender: string | null; place: string | null }[]>('/v1/admin/patients', { phone, code: q.code?.toUpperCase() }) : null;
  return (
    <>
      <Head kicker="Least data needed" title="Patients" lead="Find a person by their full mobile number or a booking code. Phone numbers stay masked unless you give a reason; every reveal is recorded." />
      <form className="filters">
        <label className="field"><span>Mobile number</span><input name="phone" defaultValue={q.phone} inputMode="tel" placeholder="10 digits" /></label>
        <label className="field"><span>or booking code</span><input name="code" defaultValue={q.code} className="mono" /></label>
        <button className="btn ghost">Find</button>
      </form>
      {!r ? <Empty title="Search to find a person." /> : null}
      {r?.error ? <LoadError error={r.error} /> : null}
      {r?.data && r.data.length === 0 ? <Empty title="Nobody found." /> : null}
      {r?.data && r.data.length > 0 ? (
        <table className="register">
          <thead><tr><th>Name</th><th>Phone</th><th>Age</th><th>Place</th><th>Joined</th><th>Account</th></tr></thead>
          <tbody>
            {r.data.map((p) => (
              <tr key={p.id}>
                <td><a className="rowlink" href={`/patients/${p.id}`}>{p.name ?? 'No profile yet'}</a></td>
                <td className="mono">{p.phone ?? '—'}</td>
                <td>{p.birthYear ? new Date().getFullYear() - p.birthYear : '—'} {p.gender ?? ''}</td>
                <td>{p.place ?? '—'}</td>
                <td className="muted">{day(p.createdAt)}</td>
                <td><Stamp s={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
