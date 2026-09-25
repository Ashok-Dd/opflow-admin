import { Empty, Head, LoadError, Pager, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { day, type Money } from '@/lib/format';

export const metadata = { title: 'Bookings' };

export interface BookingView {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  tokenLabel: string;
  emergency: boolean;
  date: string;
  time: { label: string };
  doctor: { id: string; name: string; type: string };
  hospital: { id: string; name: string };
  patient: { name: string; age: number | null; gender: string | null };
  total: Money;
  needsNewTime: boolean;
}

export default async function BookingsPage({ searchParams }: PageProps<'/bookings'>) {
  const q = sp(await searchParams);
  const searched = !!(q.code || q.phone || q.date || q.doctor);
  const phone = q.phone ? `+91${q.phone.replace(/\D/g, '').slice(-10)}` : undefined;
  const list = searched ? await load<{ items: BookingView[]; nextCursor?: string }>('/v1/admin/bookings', { code: q.code?.toUpperCase(), phone, date: q.date, doctor: q.doctor, cursor: q.cursor, limit: 30 }) : null;
  return (
    <>
      <Head kicker="Records" title="Bookings" lead="Find a booking by its code (on the patient's ticket), the patient's full mobile number, or a date." />
      <form className="filters">
        <label className="field"><span>Booking code</span><input name="code" defaultValue={q.code} placeholder="OPF7Q2K9A" className="mono" /></label>
        <label className="field"><span>Patient mobile</span><input name="phone" defaultValue={q.phone} placeholder="10 digits" inputMode="tel" /></label>
        <label className="field"><span>Date</span><input name="date" type="date" defaultValue={q.date} /></label>
        <button className="btn ghost">Find</button>
      </form>
      {!searched ? <Empty title="Search to see bookings.">Phone numbers must be complete: partial search is not allowed, to protect patients.</Empty> : null}
      {list?.error ? <LoadError error={list.error} /> : null}
      {list?.data && list.data.items.length === 0 ? <Empty title="No booking matches." /> : null}
      {list?.data && list.data.items.length > 0 ? (
        <>
          <table className="register">
            <thead><tr><th>Code</th><th>Token</th><th>Patient</th><th>Doctor</th><th>When</th><th className="num">Paid</th><th>Status</th></tr></thead>
            <tbody>
              {list.data.items.map((b) => (
                <tr key={b.id}>
                  <td><a className="rowlink mono" href={`/bookings/${b.id}`}>{b.code}</a></td>
                  <td className="mono">{b.tokenLabel}</td>
                  <td>{b.patient.name}<span className="sub">{b.patient.age ?? '—'} · {b.patient.gender ?? '—'}</span></td>
                  <td>{b.doctor.name}<span className="sub">{b.hospital.name}</span></td>
                  <td className="nowrap">{day(b.date)}<span className="sub">{b.time.label}</span></td>
                  <td className="num">{b.total.display}</td>
                  <td><Stamp s={b.status} label={b.statusLabel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager nextCursor={list.data.nextCursor} cursor={q.cursor} base={new URLSearchParams(q)} />
        </>
      ) : null}
    </>
  );
}
