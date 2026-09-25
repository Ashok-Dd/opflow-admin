import { Empty, Head, LoadError, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, time } from '@/lib/format';

export const metadata = { title: 'Live OPDs' };

interface Live {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  lateMinutes: number;
  nowSeeingToken: number | null;
  doctor: string;
  hospital: string;
  waiting: number;
  done: number;
  lastAction: string | null;
  maybeForgotten: boolean;
}

export default async function LivePage() {
  const r = await load<Live[]>('/v1/admin/live/sessions');
  return (
    <>
      <Head kicker="Read only" title="Live OPDs" lead="Every OPD running right now. Admins never press the doctor's buttons; this page is to notice problems." />
      {r.error ? <LoadError error={r.error} /> : null}
      {r.data?.length === 0 ? <Empty title="No OPD is running right now." /> : null}
      {r.data && r.data.length > 0 ? (
        <table className="register">
          <thead><tr><th>Doctor</th><th>Time</th><th className="num">Now seeing</th><th className="num">Waiting</th><th className="num">Seen</th><th>Late</th><th>Last action</th><th /></tr></thead>
          <tbody>
            {r.data.map((s) => (
              <tr key={s.id}>
                <td>{s.doctor}<span className="sub">{s.hospital}</span></td>
                <td className="mono nowrap">{time(s.startsAt)} – {time(s.endsAt)}</td>
                <td className="num">{s.nowSeeingToken ?? '—'}</td>
                <td className="num">{s.waiting}</td>
                <td className="num">{s.done}</td>
                <td>{s.lateMinutes ? `${s.lateMinutes} min` : '—'}</td>
                <td>{s.maybeForgotten ? <Stamp s="needs_attention" label={`idle · ${ago(s.lastAction)}`} /> : <span className="muted">{ago(s.lastAction)}</span>}</td>
                <td><Stamp s={s.status} /> <a className="btn ghost small" href={`/live/${s.id}`}>Line</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
