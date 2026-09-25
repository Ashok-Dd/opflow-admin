import { Empty, Head, LoadError, Sec } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, dateTime, rupees, words } from '@/lib/format';

export const metadata = { title: 'Needs attention' };

type Row = Record<string, string | number | null>;
interface Attention {
  failedRefunds: Row[];
  stuckBulkOperations: Row[];
  doctorsWaitingOver48h: Row[];
  rejectedDocuments: Row[];
  oldTickets: Row[];
  holdsNotExpired: number;
  payoutsWaiting: Row[];
  unprocessedWebhooks: Row[];
  idleOpds: Row[];
}

export default async function AttentionPage() {
  const a = await load<Attention>('/v1/admin/attention');
  if (a.error) return (<><Head title="Needs attention" /><LoadError error={a.error} /></>);
  const d = a.data;
  const total =
    d.failedRefunds.length + d.stuckBulkOperations.length + d.doctorsWaitingOver48h.length +
    d.payoutsWaiting.length + d.unprocessedWebhooks.length + d.idleOpds.length + d.rejectedDocuments.length + (d.holdsNotExpired ? 1 : 0);

  return (
    <>
      <Head kicker="One list" title="Needs attention" lead="Everything a person must look at. Oldest problems first matter most." />
      {total === 0 ? <Empty title="Nothing needs attention.">Refunds, payouts and OPDs are all on track.</Empty> : null}

      {d.failedRefunds.length ? (
        <>
          <Sec title="Refunds that keep failing" note={`${d.failedRefunds.length}`} />
          <table className="register">
            <thead><tr><th>Booking</th><th className="num">Amount</th><th>Tries</th><th>Why</th><th /></tr></thead>
            <tbody>
              {d.failedRefunds.map((r) => (
                <tr key={String(r.id)}>
                  <td className="mono">{String(r.bookingId).slice(0, 8)}</td>
                  <td className="num">{rupees(r.amountPaise)}</td>
                  <td className="mono">{r.attempts}</td>
                  <td className="muted">{r.failureReason ?? '—'}</td>
                  <td><a className="btn ghost small" href="/money?tab=refunds&status=failed">Refund queue</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.idleOpds.length ? (
        <>
          <Sec title="OPDs with no action for 45 minutes" note="doctor may have forgotten to end OPD" />
          <table className="register">
            <thead><tr><th>Doctor</th><th>Last change</th><th /></tr></thead>
            <tbody>
              {d.idleOpds.map((r) => (
                <tr key={String(r.id)}>
                  <td>{r.name}</td>
                  <td className="muted">{ago(r.updatedAt as string)}</td>
                  <td><a className="btn ghost small" href={`/live/${r.id}`}>See the line</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.payoutsWaiting.length ? (
        <>
          <Sec title="Doctor payouts waiting" note="payout account missing or transfer failed" />
          <table className="register">
            <thead><tr><th>Doctor</th><th className="num">Amount</th><th>Due since</th></tr></thead>
            <tbody>
              {d.payoutsWaiting.map((r) => (
                <tr key={String(r.id)}>
                  <td><a className="rowlink" href={`/doctors/${r.doctorId}?tab=money`}>Open doctor</a></td>
                  <td className="num">{rupees(r.amountPaise)}</td>
                  <td className="muted">{dateTime(r.releaseAt as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.stuckBulkOperations.length ? (
        <>
          <Sec title="Day cancellations that did not finish" />
          <table className="register">
            <thead><tr><th>Kind</th><th>Progress</th><th>Last change</th><th /></tr></thead>
            <tbody>
              {d.stuckBulkOperations.map((r) => (
                <tr key={String(r.id)}>
                  <td>{words(String(r.kind))}</td>
                  <td className="mono">{r.done} done · {r.failed} failed · {r.total} total</td>
                  <td className="muted">{ago(r.updatedAt as string)}</td>
                  <td><a className="rowlink" href={`/doctors/${r.doctorId}`}>Doctor</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.doctorsWaitingOver48h.length ? (
        <>
          <Sec title="Doctors waiting for verification over 48 hours" />
          <table className="register">
            <tbody>
              {d.doctorsWaitingOver48h.map((r) => (
                <tr key={String(r.id)}>
                  <td><a className="rowlink" href={`/doctors/${r.id}`}>{r.name}</a></td>
                  <td className="muted">added {ago(r.createdAt as string)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}



      {d.unprocessedWebhooks.length ? (
        <>
          <Sec title="Razorpay messages not processed" />
          <table className="register">
            <thead><tr><th>Event</th><th>Received</th><th>Error</th></tr></thead>
            <tbody>
              {d.unprocessedWebhooks.map((r) => (
                <tr key={String(r.id)}>
                  <td className="mono">{r.type}</td>
                  <td className="muted">{dateTime(r.receivedAt as string)}</td>
                  <td className="muted">{r.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.rejectedDocuments.length ? (
        <>
          <Sec title="Documents rejected in the last 2 weeks" />
          <table className="register">
            <tbody>
              {d.rejectedDocuments.map((r) => (
                <tr key={String(r.id)}>
                  <td><a className="rowlink" href={`/doctors/${r.doctorId}?tab=documents`}>{words(String(r.kind))}</a></td>
                  <td className="muted">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {d.holdsNotExpired ? (
        <div className="notice bad" style={{ marginTop: 20 }}>
          {d.holdsNotExpired} payment holds are past their time but not released. The background worker may be stopped.
        </div>
      ) : null}
    </>
  );
}
