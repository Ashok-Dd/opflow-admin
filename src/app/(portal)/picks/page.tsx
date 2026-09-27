import { Empty, Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';

export const metadata = { title: 'Doctor picks' };

interface Pick {
  doctorId: string;
  name: string;
  typeId: string;
  typeName: string;
  cities: string[] | null;
  rank: number;
  reasons: string[];
  active: boolean;
  avgRating: number | null;
  ratings: number;
  verification: string;
  status: string;
}

/** Everyone OPflow may suggest in "Find Your Right Doctor", by type of doctor. Change a pick on the doctor's page. */
export default async function PicksPage() {
  const r = await load<{ items: Pick[] }>('/v1/admin/picks');
  const groups = new Map<string, Pick[]>();
  for (const p of r.error ? [] : r.data.items) groups.set(p.typeName, [...(groups.get(p.typeName) ?? []), p]);
  return (
    <>
      <Head
        kicker="Records"
        title="Doctor picks"
        lead="Who OPflow suggests when a patient pays for “Find Your Right Doctor”. Only you decide this; doctors can never pay to be picked. Open a doctor → OPflow pick to change it."
      />
      {r.error ? (
        <LoadError error={r.error} />
      ) : groups.size === 0 ? (
        <Empty title="No picks yet.">Open a verified doctor → OPflow pick, write the reasons and switch it on.</Empty>
      ) : (
        [...groups.entries()].map(([type, items]) => (
          <Sec key={type} title={type}>
            <table className="register">
              <thead>
                <tr><th>Doctor</th><th>City</th><th className="num">Rank</th><th>Reasons patients see</th><th className="num">Feedback</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.doctorId}>
                    <td><a className="rowlink" href={`/doctors/${p.doctorId}?tab=pick`}>{p.name}</a></td>
                    <td>{(p.cities ?? []).join(', ') || '—'}</td>
                    <td className="num">{p.rank}</td>
                    <td>{p.reasons.join(' · ')}</td>
                    <td className="num">{p.avgRating != null ? `${p.avgRating.toFixed(1)} (${p.ratings})` : '—'}</td>
                    <td><Stamp s={!p.active ? 'off' : p.status === 'suspended' ? 'suspended' : p.verification === 'verified' ? 'active' : p.verification} label={!p.active ? 'off' : undefined} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sec>
        ))
      )}
    </>
  );
}
