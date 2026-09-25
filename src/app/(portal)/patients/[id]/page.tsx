import { ActionForm, Field } from '@/components/action-form';
import { Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, day } from '@/lib/format';

import { patientCommand } from '../../actions';
import type { BookingView } from '../../bookings/page';

interface Patient {
  id: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  name: string | null;
  birthYear: number | null;
  gender: string | null;
  place: string | null;
  bookings: BookingView[];
}

export default async function PatientPage({ params }: PageProps<'/patients/[id]'>) {
  const { id } = await params;
  const r = await load<Patient>(`/v1/admin/patients/${id}`);
  if (r.error) return (<><Head title="Patient" /><LoadError error={r.error} /></>);
  const p = r.data;
  return (
    <>
      <Head kicker="Patients" title={p.name ?? 'No profile yet'} lead={`Joined ${day(p.createdAt)} · last login ${p.lastLoginAt ? ago(p.lastLoginAt) : 'never'}`}>
        <Stamp s={p.status} />
      </Head>
      <div className="cols">
        <div>
          <section className="slip">
            <dl>
              <dt>Phone</dt><dd className="mono">{p.phone ?? '—'}</dd>
              <dt>Age</dt><dd>{p.birthYear ? new Date().getFullYear() - p.birthYear : '—'}</dd>
              <dt>Gender</dt><dd>{p.gender ?? '—'}</dd>
              <dt>Place</dt><dd>{p.place ?? '—'}</dd>
            </dl>
          </section>
          <Sec title="Bookings" note={`${p.bookings.length}`} />
          <table className="register">
            <tbody>
              {p.bookings.length === 0 ? <tr><td className="muted">No bookings.</td></tr> : null}
              {p.bookings.map((b) => (
                <tr key={b.id}>
                  <td><a className="rowlink mono" href={`/bookings/${b.id}`}>{b.code}</a></td>
                  <td>{b.doctor.name}<span className="sub">{b.hospital.name}</span></td>
                  <td className="nowrap">{day(b.date)}<span className="sub">{b.time.label}</span></td>
                  <td className="num">{b.total.display}</td>
                  <td><Stamp s={b.status} label={b.statusLabel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <section className="slip">
            <h3>Show the full phone number</h3>
            <ActionForm action={patientCommand} submit="Show number" hidden={{ id: p.id, cmd: 'reveal' }}>
              <Field label="Why you need it"><input name="reason" minLength={5} required placeholder="Patient asked for a call back about a refund" /></Field>
            </ActionForm>
          </section>
          {p.status !== 'deleted' ? (
            <section className="slip">
              <h3>Account</h3>
              <ActionForm action={patientCommand} submit={p.status === 'suspended' ? 'Unblock' : 'Block'} danger={p.status !== 'suspended'} hidden={{ id: p.id, cmd: p.status === 'suspended' ? 'unblock' : 'block' }}>
                <Field label="Why"><input name="reason" minLength={5} required /></Field>
              </ActionForm>
              <div style={{ marginTop: 14 }}>
                <ActionForm action={patientCommand} submit="Delete account (on request)" danger hidden={{ id: p.id, cmd: 'deletion' }} confirm="Delete this person's account? Name and phone are removed; bookings stay for the records.">
                  <Field label="Request details"><input name="reason" minLength={5} required placeholder="Asked by email on 25 Sep" /></Field>
                </ActionForm>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
