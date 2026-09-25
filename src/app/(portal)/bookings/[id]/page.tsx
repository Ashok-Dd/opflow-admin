import { ActionForm, Field } from '@/components/action-form';
import { Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { can, dateTime, day, rupees, words } from '@/lib/format';
import { me } from '@/lib/me';

import { bookingCommand } from '../../actions';
import type { BookingView } from '../page';

interface Detail {
  booking: BookingView & { note: string; changedOnce: boolean; fee: { display: string }; emergencyCharge: { paise: number; display: string }; cancelledReason: string | null; queueState: string | null };
  events: { type: string; actorType: string; data: Record<string, unknown>; at: string }[];
  payments: { id: string; razorpayOrderId: string; razorpayPaymentId: string | null; amountPaise: number; status: string; method: string | null; failureReason: string | null; abandoned: boolean; createdAt: string }[];
  refunds: { id: string; amountPaise: number; reason: string; status: string; attempts: number; razorpayRefundId: string | null; failureReason: string | null; manualReference: string | null; createdAt: string }[];
  transfers: { id: string; amountPaise: number; status: string; releaseAt: string; razorpayTransferId: string | null }[];
  queue: { version: number; type: string; at: string }[];
}

export default async function BookingPage({ params }: PageProps<'/bookings/[id]'>) {
  const { id } = await params;
  const [who, r] = await Promise.all([me(), load<Detail>(`/v1/admin/bookings/${id}`)]);
  if (r.error) return (<><Head title="Booking" /><LoadError error={r.error} /></>);
  const { booking: b, events, payments, refunds, transfers } = r.data;
  const paid = payments.filter((p) => p.status === 'captured').reduce((a, p) => a + p.amountPaise, 0);
  const back = refunds.filter((x) => x.status !== 'failed').reduce((a, x) => a + x.amountPaise, 0);

  return (
    <>
      <Head kicker={`Booking · ${b.emergency ? 'emergency consultation' : 'OPD'}`} title={b.code} lead={`${b.patient.name} with ${b.doctor.name}, ${day(b.date)} ${b.time.label}`}>
        <Stamp s={b.status} label={b.statusLabel} />
      </Head>
      <div className="cols">
        <div>
          <section className="slip">
            <h3>Ticket</h3>
            <dl>
              <dt>Token</dt><dd className="mono" style={{ fontSize: 20 }}>{b.tokenLabel}</dd>
              <dt>Patient</dt><dd>{b.patient.name} · {b.patient.age ?? '—'} · {b.patient.gender ?? '—'}</dd>
              <dt>Doctor</dt><dd><a href={`/doctors/${b.doctor.id}`}>{b.doctor.name}</a> · {b.doctor.type}</dd>
              <dt>Hospital</dt><dd><a href={`/hospitals/${b.hospital.id}`}>{b.hospital.name}</a></dd>
              <dt>When</dt><dd>{day(b.date)}, {b.time.label}</dd>
              <dt>Line</dt><dd>{words(b.queueState ?? '—')}</dd>
              <dt>Note from patient</dt><dd>{b.note || '—'}</dd>
              <dt>Money</dt><dd className="mono">fee {b.fee.display}{b.emergencyCharge.paise ? ` + emergency ${b.emergencyCharge.display}` : ''} · paid {rupees(paid)} · back {rupees(back)}</dd>
              {b.changedOnce ? (<><dt>Changed</dt><dd>Patient changed the time once</dd></>) : null}
              {b.cancelledReason ? (<><dt>Cancelled because</dt><dd>{b.cancelledReason}</dd></>) : null}
            </dl>
          </section>

          <Sec title="Payments" />
          <table className="register">
            <thead><tr><th>Razorpay</th><th className="num">Amount</th><th>Status</th><th>Method</th><th>Made</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.razorpayPaymentId ?? p.razorpayOrderId}{p.abandoned ? <span className="sub">replaced by a retry</span> : null}{p.failureReason ? <span className="sub">{p.failureReason}</span> : null}</td>
                  <td className="num">{rupees(p.amountPaise)}</td>
                  <td><Stamp s={p.status} /></td>
                  <td>{p.method ?? '—'}</td>
                  <td className="muted">{dateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {refunds.length ? (
            <>
              <Sec title="Money back" />
              <table className="register">
                <thead><tr><th>Why</th><th className="num">Amount</th><th>Status</th><th>Reference</th><th>Started</th></tr></thead>
                <tbody>
                  {refunds.map((x) => (
                    <tr key={x.id}>
                      <td>{words(x.reason)}{x.failureReason ? <span className="sub">{x.failureReason}</span> : null}</td>
                      <td className="num">{rupees(x.amountPaise)}</td>
                      <td><Stamp s={x.status} /></td>
                      <td className="mono">{x.razorpayRefundId ?? x.manualReference ?? '—'}</td>
                      <td className="muted">{dateTime(x.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {transfers.length ? (
            <>
              <Sec title="Doctor payout" note="90% of the fee" />
              <table className="register">
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td className="num">{rupees(t.amountPaise)}</td>
                      <td><Stamp s={t.status} /></td>
                      <td className="muted">release {dateTime(t.releaseAt)}</td>
                      <td className="mono">{t.razorpayTransferId ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <Sec title="Timeline" />
          <ol className="timeline">
            {events.map((e, i) => (
              <li key={i}>
                <div className="when">{dateTime(e.at)} · {e.actorType}</div>
                <div>{words(e.type)}</div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          {can(who.role, 'money') && paid - back > 0 ? (
            <section className="slip">
              <h3>Goodwill refund</h3>
              <p className="faint" style={{ marginTop: 0 }}>Up to {rupees(paid - back)}. Asks for your authenticator code and is recorded in the audit log.</p>
              <ActionForm action={bookingCommand} submit="Refund" hidden={{ id: b.id, cmd: 'refund' }} confirm="Send this money back to the patient?">
                <Field label="Amount (₹)"><input name="amount" inputMode="decimal" required /></Field>
                <Field label="Why"><input name="reason" minLength={5} required placeholder="Doctor was 3 hours late" /></Field>
              </ActionForm>
            </section>
          ) : null}
          {can(who.role, 'addDoctor') && b.status === 'confirmed' ? (
            <section className="slip">
              <h3>On the doctor&apos;s behalf</h3>
              <ActionForm action={bookingCommand} submit="Move to another time" hidden={{ id: b.id, cmd: 'move' }}>
                <Field label="Why (note the doctor's consent)"><input name="reason" minLength={3} required /></Field>
              </ActionForm>
              <div style={{ marginTop: 12 }}>
                <ActionForm action={bookingCommand} submit="Cancel with full refund" danger hidden={{ id: b.id, cmd: 'cancel' }} confirm="Cancel this booking and give all the money back?">
                  <Field label="Why"><input name="reason" minLength={3} required /></Field>
                </ActionForm>
              </div>
            </section>
          ) : null}
          <section className="slip">
            <h3>Receipt</h3>
            <ActionForm action={bookingCommand} submit="Send receipt message again" hidden={{ id: b.id, cmd: 'resend-receipt' }} />
          </section>
        </div>
      </div>
    </>
  );
}
