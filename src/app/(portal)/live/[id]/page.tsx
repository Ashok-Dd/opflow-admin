import { Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, time, words } from '@/lib/format';

interface Line {
  sessionId: string;
  version: number;
  status: string;
  hospital: { name: string };
  time: { label: string };
  lateMinutes: number;
  avgConsultMinutes: number;
  nowSeeing: { tokenLabel: string; name: string } | null;
  counts: Record<string, number>;
  line: { bookingId: string; tokenLabel: string; emergency: boolean; state: string; name: string; age: number | null; hour: string | null; reachedAt: string | null; calledAt: string | null }[];
  events: { version: number; type: string; at: string }[];
}

export default async function LineOfSession({ params }: PageProps<'/live/[id]'>) {
  const { id } = await params;
  const r = await load<Line>(`/v1/admin/live/sessions/${id}`);
  if (r.error) return (<><Head title="Line" /><LoadError error={r.error} /></>);
  const l = r.data;
  return (
    <>
      <Head kicker={`Live OPDs · ${l.hospital.name}`} title={l.nowSeeing ? `Now seeing ${l.nowSeeing.tokenLabel}` : 'Nobody with the doctor'} lead={`${l.time.label} · about ${l.avgConsultMinutes} min per patient${l.lateMinutes ? ` · running ${l.lateMinutes} min late` : ''}`}>
        <Stamp s={l.status} />
      </Head>
      <dl className="figures" style={{ marginBottom: 16 }}>
        {Object.entries(l.counts).map(([k, v]) => (
          <div key={k}><dt>{words(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="cols">
        <table className="register">
          <thead><tr><th>Token</th><th>Patient</th><th>Hour</th><th>State</th><th>Reached</th></tr></thead>
          <tbody>
            {l.line.map((e) => (
              <tr key={e.bookingId}>
                <td className="mono">{e.tokenLabel}</td>
                <td>{e.name}<span className="sub">{e.age ?? '—'}{e.emergency ? ' · emergency' : ''}</span></td>
                <td className="muted">{e.hour ?? 'now'}</td>
                <td><Stamp s={e.state} /></td>
                <td className="mono">{e.reachedAt ? time(e.reachedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <Sec title="What happened" note={`version ${l.version}`} />
          <ol className="timeline">
            {l.events.slice(0, 40).map((e) => (
              <li key={e.version}>
                <div className="when">{dateTime(e.at)} · v{e.version}</div>
                <div>{words(e.type)}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
