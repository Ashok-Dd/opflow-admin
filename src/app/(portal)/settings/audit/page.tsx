import { Empty, Head, LoadError, sp } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, words } from '@/lib/format';

export const metadata = { title: 'Audit log' };

interface Entry { id: string; at: string; actorType: string; actorName: string | null; action: string; entity: string; entityId: string | null; before: unknown; after: unknown; ip: string | null }

export default async function AuditPage({ searchParams }: PageProps<'/settings/audit'>) {
  const q = sp(await searchParams);
  const [r] = await Promise.all([load<Entry[]>('/v1/admin/audit', { action: q.action, entity: q.entity, entityId: q.entityId, from: q.from, to: q.to, limit: 50 })]);
  return (
    <>
      <Head kicker="Settings" title="Audit log" lead="Everything done in the admin site and by the system, with the reason given. Entries can never be changed or deleted." />
      <form className="filters">
        <label className="field"><span>Action starts with</span><input name="action" defaultValue={q.action} placeholder="doctor., refund., patient.reveal" /></label>
        <label className="field"><span>Entity</span><input name="entity" defaultValue={q.entity} placeholder="doctor, booking, user" /></label>
        <label className="field"><span>From</span><input type="date" name="from" defaultValue={q.from} /></label>
        <label className="field"><span>To</span><input type="date" name="to" defaultValue={q.to} /></label>
        <button className="btn ghost">Show</button>
      </form>
      {r.error ? <LoadError error={r.error} /> : r.data.length === 0 ? <Empty title="Nothing recorded for this search." /> : (
        <table className="register">
          <thead><tr><th>When</th><th>Who</th><th>Did</th><th>On</th><th>Details</th></tr></thead>
          <tbody>
            {r.data.map((e) => (
              <tr key={e.id}>
                <td className="mono nowrap">{dateTime(e.at)}</td>
                <td>{e.actorName ?? e.actorType}<span className="sub mono">{e.ip ?? ''}</span></td>
                <td>{words(e.action)}</td>
                <td className="mono">{e.entity}{e.entityId ? <span className="sub">{e.entityId.slice(0, 13)}</span> : null}</td>
                <td>
                  {e.after || e.before ? (
                    <details className="raw">
                      <summary>Show</summary>
                      <pre>{JSON.stringify({ before: e.before, after: e.after }, null, 2)}</pre>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
