import { ActionForm } from '@/components/action-form';
import { Empty, Head, LoadError, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, can, time } from '@/lib/format';
import { me } from '@/lib/me';

import { emergencyOff } from '../actions';

export const metadata = { title: 'Emergency' };

export default async function EmergencyPage() {
  const [who, r] = await Promise.all([
    me(),
    load<{ doctorId: string; name: string; status: string; untilAt: string | null; mode: string; updatedAt: string; hospital: string | null }[]>('/v1/admin/emergency'),
  ]);
  return (
    <>
      <Head kicker="Right now" title="Emergency" lead="Doctors marked as taking emergency patients. Patients see them on the Emergency screen and can book a paid emergency consultation." />
      {r.error ? <LoadError error={r.error} /> : null}
      {r.data?.length === 0 ? <Empty title="No doctor is marked available right now." /> : null}
      {r.data && r.data.length > 0 ? (
        <table className="register">
          <thead><tr><th>Doctor</th><th>Where</th><th>Status</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {r.data.map((e) => (
              <tr key={e.doctorId}>
                <td><a className="rowlink" href={`/doctors/${e.doctorId}`}>{e.name}</a></td>
                <td>{e.hospital ?? '—'}</td>
                <td><Stamp s={e.status} label={e.status === 'available_till' && e.untilAt ? `till ${time(e.untilAt)}` : undefined} /></td>
                <td className="muted">{ago(e.updatedAt)}</td>
                <td>
                  {can(who.role, 'addDoctor') ? (
                    <ActionForm action={emergencyOff} submit="Turn off" small danger inline hidden={{ doctorId: e.doctorId }} confirm={{ title: 'Turn off this doctor\'s emergency status?', text: 'Patients will no longer see this doctor in emergency help.', yes: 'Yes, turn off' }}>
                      <input name="reason" required minLength={5} placeholder="Why (the doctor is told)" style={{ width: 220, marginRight: 6 }} />
                    </ActionForm>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
