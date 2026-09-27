import { ActionForm } from '@/components/action-form';
import { Empty, Head, LoadError, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, day, rupees, todayIst, words, type Money } from '@/lib/format';

import { refundCommand, refundPick } from '../actions';

export const metadata = { title: 'Refunds & payouts' };

const TABS = ['refunds', 'payouts', 'payments', 'suggestions', 'reconciliation'] as const;

export default async function MoneyPage({ searchParams }: PageProps<'/money'>) {
  const q = sp(await searchParams);
  const tab = (TABS as readonly string[]).includes(q.tab ?? '') ? q.tab! : 'refunds';
  return (
    <>
      <Head kicker="Finance" title="Refunds & payouts" lead="Money back to patients, 90% payouts to doctors, and the daily check that every rupee is accounted for." />
      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t} href={`?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>{words(t)}</a>
        ))}
      </nav>
      {tab === 'refunds' ? <Refunds status={q.status} /> : null}
      {tab === 'payouts' ? <Payouts status={q.status} /> : null}
      {tab === 'payments' ? <Payments status={q.status} /> : null}
      {tab === 'suggestions' ? <Suggestions status={q.status} /> : null}
      {tab === 'reconciliation' ? <Reconciliation date={q.date ?? todayIst()} /> : null}
    </>
  );
}

function StatusFilter({ tab, options, value }: { tab: string; options: string[]; value?: string }) {
  return (
    <form className="filters">
      <input type="hidden" name="tab" value={tab} />
      <label className="field">
        <span>Status</span>
        <select name="status" defaultValue={value ?? ''}>
          <option value="">Any</option>
          {options.map((o) => <option key={o} value={o}>{words(o)}</option>)}
        </select>
      </label>
      <button className="btn ghost">Show</button>
    </form>
  );
}

async function Refunds({ status }: { status?: string }) {
  const r = await load<{ id: string; amountPaise: number; reason: string; status: string; attempts: number; failureReason: string | null; razorpayRefundId: string | null; manualReference: string | null; createdAt: string; bookingId: string; code: string; patientName: string }[]>('/v1/admin/refunds', { status, limit: 50 });
  return (
    <>
      <StatusFilter tab="refunds" options={['pending', 'failed', 'processed']} value={status} />
      {r.error ? <LoadError error={r.error} /> : r.data.length === 0 ? <Empty title="No refunds here." /> : (
        <table className="register">
          <thead><tr><th>Booking</th><th>Why</th><th className="num">Amount</th><th>Status</th><th>Started</th><th /></tr></thead>
          <tbody>
            {r.data.map((x) => (
              <tr key={x.id}>
                <td><span className="mono">{x.code}</span><span className="sub">{x.patientName}</span></td>
                <td>{words(x.reason)}{x.failureReason ? <span className="sub">{x.failureReason}</span> : null}</td>
                <td className="num">{rupees(x.amountPaise)}</td>
                <td><Stamp s={x.status} />{x.attempts ? <span className="sub">{x.attempts} tries</span> : null}</td>
                <td className="muted">{dateTime(x.createdAt)}</td>
                <td>
                  {x.status === 'failed' ? (
                    <div className="actions">
                      <ActionForm action={refundCommand} submit="Try again" small inline hidden={{ id: x.id, cmd: 'retry' }} confirm={{ title: 'Try this refund again?', text: 'Razorpay is asked to send the money back to the patient again.', yes: 'Yes, try again' }} />
                      <ActionForm action={refundCommand} submit="Paid by bank" small inline hidden={{ id: x.id, cmd: 'mark-paid' }} confirm={{ title: 'Mark as paid by bank?', text: 'Only when the money really reached the patient by bank transfer. This closes the refund.', yes: 'Yes, it is paid' }}>
                        <input name="utr" placeholder="UTR number" required pattern="[A-Za-z0-9]{8,40}" style={{ width: 150, marginRight: 6 }} />
                      </ActionForm>
                    </div>
                  ) : <span className="mono faint">{x.razorpayRefundId ?? x.manualReference ?? ''}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

async function Payouts({ status }: { status?: string }) {
  const r = await load<{ id: string; doctorId: string; doctor: string; amountPaise: number; status: string; releaseAt: string; releasedAt: string | null; code: string }[]>('/v1/admin/transfers', { status, limit: 50 });
  return (
    <>
      <StatusFilter tab="payouts" options={['on_hold', 'released', 'reversed', 'failed']} value={status} />
      {r.error ? <LoadError error={r.error} /> : r.data.length === 0 ? <Empty title="No payouts here." /> : (
        <table className="register">
          <thead><tr><th>Doctor</th><th>Booking</th><th className="num">Amount</th><th>Status</th><th>Release</th></tr></thead>
          <tbody>
            {r.data.map((t) => (
              <tr key={t.id}>
                <td><a className="rowlink" href={`/doctors/${t.doctorId}?tab=money`}>{t.doctor}</a></td>
                <td className="mono">{t.code}</td>
                <td className="num">{rupees(t.amountPaise)}</td>
                <td><Stamp s={t.status} /></td>
                <td className="muted">{t.releasedAt ? `sent ${dateTime(t.releasedAt)}` : day(t.releaseAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

async function Payments({ status }: { status?: string }) {
  const r = await load<{ id: string; bookingId: string; code: string; razorpayPaymentId: string | null; razorpayOrderId: string; amountPaise: number; status: string; method: string | null; failureReason: string | null; createdAt: string }[]>('/v1/admin/payments', { status, limit: 50 });
  return (
    <>
      <StatusFilter tab="payments" options={['created', 'captured', 'failed']} value={status} />
      {r.error ? <LoadError error={r.error} /> : r.data.length === 0 ? <Empty title="No payments here." /> : (
        <table className="register">
          <thead><tr><th>Booking</th><th>Razorpay</th><th className="num">Amount</th><th>Method</th><th>Status</th><th>Made</th></tr></thead>
          <tbody>
            {r.data.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td className="mono">{p.razorpayPaymentId ?? p.razorpayOrderId}</td>
                <td className="num">{rupees(p.amountPaise)}</td>
                <td>{p.method ?? '—'}</td>
                <td><Stamp s={p.status} />{p.failureReason ? <span className="sub">{p.failureReason}</span> : null}</td>
                <td className="muted">{dateTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

async function Reconciliation({ date }: { date: string }) {
  const r = await load<{ date: string; payments: number; captured: Money; refunded: Money; toDoctors: Money; opflow: Money; mismatches: number; ok: boolean }>('/v1/admin/reconciliation', { date });
  return (
    <>
      <form className="filters">
        <input type="hidden" name="tab" value="reconciliation" />
        <label className="field"><span>Day</span><input type="date" name="date" defaultValue={date} /></label>
        <button className="btn ghost">Check</button>
        <a className="btn ghost" href={`/money/export?kind=payments&from=${date}&to=${date}`}>Payments CSV</a>
        <a className="btn ghost" href={`/money/export?kind=refunds&from=${date}&to=${date}`}>Refunds CSV</a>
        <a className="btn ghost" href={`/money/export?kind=transfers&from=${date}&to=${date}`}>Payouts CSV</a>
      </form>
      {r.error ? <LoadError error={r.error} /> : (
        <>
          <dl className="figures">
            <div><dt>Payments</dt><dd>{r.data.payments}</dd></div>
            <div><dt>Money in</dt><dd className="small mono">{r.data.captured.display}</dd></div>
            <div><dt>Given back</dt><dd className="small mono">{r.data.refunded.display}</dd></div>
            <div><dt>To doctors</dt><dd className="small mono">{r.data.toDoctors.display}</dd></div>
            <div><dt>OPflow keeps</dt><dd className="small mono">{r.data.opflow.display}</dd></div>
          </dl>
          <div className={`notice ${r.data.ok ? '' : 'bad'}`} style={{ marginTop: 14 }}>
            {r.data.ok ? 'Every payment of this day has a doctor payout or a refund. Nothing is missing.' : `${r.data.mismatches} payment(s) have neither a payout nor a refund. Open the payments tab and check them.`}
          </div>
        </>
      )}
    </>
  );
}

/** The ₹99 "Find Your Right Doctor" suggestions (OPflow keeps it all; no doctor share). */
async function Suggestions({ status }: { status?: string }) {
  const r = await load<{ items: { id: string; status: string; typeName: string; place: string | null; amountPaise: number; paidAt: string | null; createdAt: string; phone: string | null; count: number; refundReason: string | null }[] }>(
    '/v1/admin/picks/purchases',
    { status, limit: 50 },
  );
  return (
    <>
      <StatusFilter tab="suggestions" options={['paid', 'refunded']} value={status} />
      {r.error ? <LoadError error={r.error} /> : r.data.items.length === 0 ? <Empty title="No suggestions sold yet." /> : (
        <table className="register">
          <thead><tr><th>Patient</th><th>Type of doctor</th><th>Area</th><th className="num">Doctors</th><th className="num">Amount</th><th>Status</th><th>Paid</th><th /></tr></thead>
          <tbody>
            {r.data.items.map((x) => (
              <tr key={x.id}>
                <td className="mono">{x.phone ?? '—'}</td>
                <td>{x.typeName}</td>
                <td>{x.place ?? <span className="faint">—</span>}</td>
                <td className="num">{x.count}</td>
                <td className="num">{rupees(x.amountPaise)}</td>
                <td><Stamp s={x.status} />{x.refundReason ? <span className="sub">{x.refundReason}</span> : null}</td>
                <td className="muted">{x.paidAt ? dateTime(x.paidAt) : '—'}</td>
                <td>
                  {x.status === 'paid' ? (
                    <ActionForm
                      action={refundPick}
                      submit="Refund"
                      small
                      inline
                      danger
                      hidden={{ id: x.id }}
                      confirm={{ title: 'Give this ₹99 back?', text: 'The patient gets the full amount back in 5–7 days. Their saved suggestion stays readable.', yes: 'Yes, refund' }}
                    >
                      <input name="reason" placeholder="Why" required minLength={5} style={{ width: 150, marginRight: 6 }} />
                    </ActionForm>
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
