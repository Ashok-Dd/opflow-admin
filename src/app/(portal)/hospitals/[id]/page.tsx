import { Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { can, time } from '@/lib/format';
import { me } from '@/lib/me';

import { updateHospital } from '../../actions';
import { HospitalForm, type HospitalValues } from '../hospital-form';

interface Detail extends HospitalValues {
  id: string;
  name: string;
  doctors: { id: string; name: string; type: { name: string }; verified: boolean; fee: { display: string } }[];
  todaySessions: { id: string; status: string; startsAt: string; endsAt: string; doctorName: string }[];
}

export default async function HospitalPage({ params }: PageProps<'/hospitals/[id]'>) {
  const { id } = await params;
  const [who, h, cat] = await Promise.all([me(), load<Detail>(`/v1/admin/hospitals/${id}`), load<{ doctorTypes: { id: string; simpleName: string }[] }>('/v1/catalog')]);
  if (h.error) return (<><Head title="Hospital" /><LoadError error={h.error} /></>);
  const d = h.data;
  return (
    <>
      <Head kicker="Hospitals" title={d.name} lead={`${d.address} · ${d.phone}`}>
        <Stamp s={d.status ?? 'active'} />
        {d.hasEmergency ? <Stamp s="active" label="24 h emergency" /> : null}
      </Head>
      <div className="cols">
        <div>
          <Sec title="Doctors here" />
          <table className="register">
            <tbody>
              {d.doctors.length === 0 ? <tr><td className="muted">No doctors linked yet.</td></tr> : null}
              {d.doctors.map((x) => (
                <tr key={x.id}>
                  <td><a className="rowlink" href={`/doctors/${x.id}`}>{x.name}</a><span className="sub">{x.type.name}</span></td>
                  <td className="num">{x.fee.display}</td>
                  <td><Stamp s={x.verified ? 'verified' : 'pending'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Sec title="OPDs today" />
          <table className="register">
            <tbody>
              {d.todaySessions.length === 0 ? <tr><td className="muted">No OPD here today.</td></tr> : null}
              {d.todaySessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.doctorName}</td>
                  <td className="mono">{time(s.startsAt)} – {time(s.endsAt)}</td>
                  <td><Stamp s={s.status} /></td>
                  <td><a className="btn ghost small" href={`/live/${s.id}`}>Line</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can(who.role, 'editHospitals') && cat.data ? (
          <section className="slip">
            <h3>Edit</h3>
            <HospitalForm action={updateHospital} types={cat.data.doctorTypes} v={d} submit="Save" />
          </section>
        ) : null}
      </div>
    </>
  );
}
