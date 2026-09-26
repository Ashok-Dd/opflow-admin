import { ActionForm, Field } from '@/components/action-form';
import { Head, LoadError, Sec, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, can, dateTime, day, rupees, words, type Money } from '@/lib/format';
import { me } from '@/lib/me';

import { doctorCommand, linkHospital, savePayout, unlinkHospital, updateDoctor } from '../../actions';

interface Doctor {
  id: string;
  name: string;
  gender: string;
  typeId: string;
  degrees: string;
  regCouncil: string;
  regNo: string;
  yearsExperience: number;
  languages: string[];
  about: string;
  fee: Money;
  verification: string;
  verificationNote: string | null;
  verifiedAt: string | null;
  status: string;
  bookingsPaused: boolean;
  listedAt: string | null;
  createdAt: string;
  phone: string | null;
  email: string | null;
  lastLoginAt: string | null;
  loginId: string | null;
  mustChange: boolean | null;
  lockedUntil: string | null;
  failedAttempts: number | null;
  photo: { s: string; m: string; l: string } | null;
  documents: { id: string; kind: string; status: string; note: string | null; reviewedAt: string | null; createdAt: string }[];
  hospitals: { id: string; name: string; area: string; isPrimary: boolean; feePaiseOverride: number | null; status: string }[];
  payout: { status: string; bankLast4: string | null; ifsc: string | null } | null;
  devices: { id: string; device: string; appVersion: string | null; signedInAt: string; lastUsedAt: string; ip: string | null }[];
  checklist: Record<string, boolean>;
  timings: { hospitalId: string; days: { weekday: number; blocks: { start: string; end: string; perHour: number }[] }[] }[];
}

const TABS = ['overview', 'hospitals', 'money', 'login', 'history'] as const;
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function DoctorPage({ params, searchParams }: PageProps<'/doctors/[id]'>) {
  const { id } = await params;
  const q = sp(await searchParams);
  const tab = (TABS as readonly string[]).includes(q.tab ?? '') ? (q.tab as (typeof TABS)[number]) : 'overview';
  const [who, doc] = await Promise.all([me(), load<Doctor>(`/v1/admin/doctors/${id}`)]);
  if (doc.error) return (<><Head title="Doctor" /><LoadError error={doc.error} /></>);
  const d = doc.data;
  const edit = can(who.role, 'addDoctor');

  return (
    <>
      <Head kicker={`Doctors · ${d.loginId ?? 'no login'}`} title={d.name} lead={`${d.degrees} · ${words(d.gender)} · ${d.yearsExperience} years · ${d.fee.display}`}>
        <Stamp s={d.status === 'suspended' ? 'suspended' : d.verification} />
        {d.bookingsPaused ? <Stamp s="paused" label="bookings paused" /> : null}
      </Head>
      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t} href={`?tab=${t}`} aria-current={t === tab ? 'page' : undefined}>
            {t === 'login' ? 'Login & security' : words(t)}
          </a>
        ))}
      </nav>

      {tab === 'overview' ? (
        <div className="cols">
          <div>
            <section className="slip">
              <h3>What patients see</h3>
              <div style={{ display: 'flex', gap: 14 }}>
                {d.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo.m} alt="" width={104} height={130} style={{ objectFit: 'cover', border: '1px solid var(--rule)' }} />
                ) : (
                  <div style={{ width: 104, height: 130, background: 'var(--mint)', display: 'grid', placeItems: 'center', font: '500 34px var(--serif)', color: 'var(--forest)' }}>
                    {d.name.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                )}
                <dl style={{ flex: 1 }}>
                  <dt>Type</dt><dd>{d.typeId}</dd>
                  <dt>Languages</dt><dd>{d.languages.join(', ') || '—'}</dd>
                  <dt>About</dt><dd>{d.about || <span className="faint">not written yet</span>}</dd>
                  <dt>Registration</dt><dd className="mono">{d.regCouncil} {d.regNo} <span className="faint">(never shown to patients)</span></dd>
                </dl>
              </div>
            </section>
            {edit ? (
              <section className="slip">
                <h3>Edit</h3>
                <ActionForm action={updateDoctor} submit="Save" hidden={{ id: d.id }}>
                  <div className="grid3">
                    <Field label="Fee (₹)"><input name="fee" defaultValue={String(d.fee.paise / 100)} /></Field>
                    <Field label="Years"><input name="years" defaultValue={String(d.yearsExperience)} /></Field>
                    <Field label="Gender">
                      <select name="gender" defaultValue={d.gender}>
                        <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Languages" hint="comma separated"><input name="languages" defaultValue={d.languages.join(', ')} /></Field>
                  <Field label="About"><textarea name="about" maxLength={240} defaultValue={d.about} /></Field>
                  <details>
                    <summary className="muted" style={{ cursor: 'pointer', marginBottom: 8 }}>Change registered details (name, type, degrees, registration): asks for your authenticator code</summary>
                    <div className="grid2">
                      <Field label="Name"><input name="l_name" placeholder={d.name} /></Field>
                      <Field label="Type id"><input name="l_typeId" placeholder={d.typeId} /></Field>
                      <Field label="Degrees"><input name="l_degrees" placeholder={d.degrees} /></Field>
                      <Field label="Council"><input name="l_regCouncil" placeholder={d.regCouncil} /></Field>
                      <Field label="Registration number"><input name="l_regNo" placeholder={d.regNo} /></Field>
                      <Field label="Why"><input name="reason" /></Field>
                    </div>
                  </details>
                </ActionForm>
              </section>
            ) : null}
          </div>
          <div>
            <section className="slip">
              <h3>Verification checklist</h3>
              <ul className="checklist">
                <li className={d.regNo ? 'done' : ''}><span>Registration number on record <span className="mono">{d.regCouncil} {d.regNo}</span></span></li>
                <li className={d.checklist.hospitalLinked ? 'done' : ''}>At least one hospital linked</li>
                <li className={d.checklist.payoutActive ? 'done' : ''}><span>Payout account active <span className="faint">(or going live without payouts on purpose)</span></span></li>
                <li>
                  <span>
                    Name and number checked on the council website:{' '}
                    <a href="https://www.nmc.org.in/information-desk/indian-medical-register/" target="_blank" rel="noreferrer">NMC register</a>
                  </span>
                </li>
              </ul>
              {d.verificationNote ? <div className="notice warn">{d.verificationNote}</div> : null}
              {edit && d.verification !== 'verified' ? (
                <>
                  <ActionForm action={doctorCommand} submit="Verify doctor" hidden={{ id: d.id, cmd: 'verify' }} confirm="You checked the list above? Patients will be able to find and book this doctor.">
                    <Field label="What you checked"><input name="reason" minLength={5} required placeholder="Council record matches the name and number" /></Field>
                  </ActionForm>
                  <div style={{ marginTop: 10 }}>
                    <ActionForm action={doctorCommand} submit="Needs correction" hidden={{ id: d.id, cmd: 'needs-correction' }}>
                      <Field label="What must be fixed"><input name="reason" minLength={5} required /></Field>
                    </ActionForm>
                  </div>
                </>
              ) : null}
              {d.verifiedAt ? <p className="faint">Verified {dateTime(d.verifiedAt)} · listed {dateTime(d.listedAt)}</p> : null}
            </section>
            {edit ? (
              <section className="slip">
                <h3>{d.status === 'suspended' ? 'Suspended' : 'Suspend'}</h3>
                {d.status === 'suspended' ? (
                  <ActionForm action={doctorCommand} submit="Make active again" hidden={{ id: d.id, cmd: 'reactivate' }} />
                ) : (
                  <ActionForm action={doctorCommand} submit="Suspend now" danger hidden={{ id: d.id, cmd: 'suspend' }} confirm="Hide this doctor now and refund every future booking in full?">
                    <Field label="Why"><input name="reason" minLength={5} required placeholder="Registration expired" /></Field>
                  </ActionForm>
                )}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'hospitals' ? <HospitalsTab d={d} edit={edit} /> : null}
      {tab === 'money' ? <MoneyTab d={d} edit={edit} /> : null}

      {tab === 'login' ? (
        <div className="cols even">
          <section className="slip">
            <h3>Login</h3>
            <dl>
              <dt>Login ID</dt><dd className="mono">{d.loginId ?? '—'}</dd>
              <dt>Mobile</dt><dd>{d.phone ?? '—'}</dd>
              <dt>Last login</dt><dd>{d.lastLoginAt ? ago(d.lastLoginAt) : 'never'}</dd>
              <dt>First password</dt><dd>{d.mustChange ? 'not changed yet' : 'changed by the doctor'}</dd>
              <dt>Locked</dt><dd>{d.lockedUntil && new Date(d.lockedUntil) > new Date() ? `until ${dateTime(d.lockedUntil)}` : 'no'}</dd>
            </dl>
            <h3 style={{ marginTop: 16 }}>Signed-in devices <span className="faint" style={{ font: '12px var(--sans)' }}>· at most 2</span></h3>
            {d.devices.length === 0 ? <p className="muted">Not signed in anywhere.</p> : (
              <table className="register">
                <tbody>
                  {d.devices.map((x) => (
                    <tr key={x.id}>
                      <td>{x.device}{x.appVersion ? <span className="sub">app {x.appVersion}</span> : null}</td>
                      <td className="muted">signed in {dateTime(x.signedInAt)}<span className="sub">last used {ago(x.lastUsedAt)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="slip">
            <h3>Help the doctor</h3>
            <ActionForm action={doctorCommand} submit="Unlock login" hidden={{ id: d.id, cmd: 'unlock' }} />
            <div style={{ marginTop: 12 }}>
              <ActionForm action={doctorCommand} submit="Sign out on every phone" hidden={{ id: d.id, cmd: 'sign-out-everywhere' }} confirm="Sign this doctor out everywhere?" />
            </div>
            <div style={{ marginTop: 12 }}>
              <ResetPassword id={d.id} />
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'history' ? <HistoryTab id={d.id} /> : null}
    </>
  );
}

function ResetPassword({ id }: { id: string }) {
  return (
    <ActionForm action={doctorCommand} submit="Make a new one-time password" hidden={{ id, cmd: 'reset-password' }} confirm="The doctor's current password stops working. Continue?">
      <Field label="Why"><input name="reason" minLength={5} required placeholder="Doctor forgot the password (called from their number)" /></Field>
    </ActionForm>
  );
}

async function HospitalsTab({ d, edit }: { d: Doctor; edit: boolean }) {
  const all = await load<{ items: { id: string; name: string; area: string }[] }>('/v1/admin/hospitals', { limit: 50 });
  const byId = new Map(d.hospitals.map((h) => [h.id, h.name]));
  return (
    <div className="cols">
      <div>
        <table className="register">
          <thead><tr><th>Hospital</th><th>Main</th><th className="num">Fee here</th><th>Status</th><th /></tr></thead>
          <tbody>
            {d.hospitals.map((h) => (
              <tr key={h.id}>
                <td><a className="rowlink" href={`/hospitals/${h.id}`}>{h.name}</a><span className="sub">{h.area}</span></td>
                <td>{h.isPrimary ? '✓' : ''}</td>
                <td className="num">{h.feePaiseOverride ? rupees(h.feePaiseOverride) : d.fee.display}</td>
                <td><Stamp s={h.status} /></td>
                <td>
                  {edit && h.status === 'active' ? (
                    <ActionForm action={unlinkHospital} submit="Unlink" small danger hidden={{ id: d.id, hospitalId: h.id }} confirm="Stop this doctor's OPDs at this hospital?" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Sec title="Weekly timings" note="set by the doctor in the app" />
        {d.timings.length === 0 ? <p className="muted">The doctor has not set timings yet.</p> : null}
        {d.timings.map((t) => (
          <table key={t.hospitalId} className="register" style={{ marginBottom: 10 }}>
            <thead><tr><th colSpan={2}>{byId.get(t.hospitalId) ?? 'Hospital'}</th></tr></thead>
            <tbody>
              {t.days.map((x) => (
                <tr key={x.weekday}>
                  <td className="mono" style={{ width: 60 }}>{WEEK[x.weekday - 1]}</td>
                  <td>{x.blocks.length ? x.blocks.map((b) => `${b.start}–${b.end} (${b.perHour}/hour)`).join(', ') : <span className="faint">off</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      {edit ? (
        <section className="slip">
          <h3>Link a hospital</h3>
          <ActionForm action={linkHospital} submit="Link" hidden={{ id: d.id }}>
            <Field label="Hospital">
              <select name="hospitalId" required defaultValue="">
                <option value="" disabled>Choose</option>
                {(all.data?.items ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.name}, {h.area}</option>
                ))}
              </select>
            </Field>
            <Field label="Different fee here (₹)" hint="optional"><input name="fee" inputMode="numeric" /></Field>
            <label className="actions" style={{ marginBottom: 10 }}><input type="checkbox" name="isPrimary" /> Main hospital</label>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}

async function MoneyTab({ d, edit }: { d: Doctor; edit: boolean }) {
  const transfers = await load<{ id: string; amountPaise: number; status: string; releaseAt: string; code: string }[]>('/v1/admin/transfers', { doctor: d.id, limit: 50 });
  return (
    <div className="cols">
      <div>
        <Sec title="Payouts" note="90% of each fee, released 24 h after the OPD" />
        {transfers.error ? <LoadError error={transfers.error} /> : (
          <table className="register">
            <thead><tr><th>Booking</th><th className="num">Amount</th><th>Status</th><th>Release</th></tr></thead>
            <tbody>
              {transfers.data.length === 0 ? <tr><td colSpan={4} className="muted">No payouts yet.</td></tr> : null}
              {transfers.data.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td className="num">{rupees(t.amountPaise)}</td>
                  <td><Stamp s={t.status} /></td>
                  <td className="muted">{day(t.releaseAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <section className="slip">
        <h3>Bank account (Razorpay Route)</h3>
        {d.payout?.bankLast4 ? (
          <p>Account …<span className="mono">{d.payout.bankLast4}</span> · {d.payout.ifsc} · <Stamp s={d.payout.status} /></p>
        ) : (
          <p className="muted">No bank account yet.</p>
        )}
        {edit ? (
          <ActionForm action={savePayout} submit={d.payout?.bankLast4 ? 'Replace account' : 'Add account'} hidden={{ id: d.id }}>
            <Field label="Account holder"><input name="holderName" required /></Field>
            <div className="grid2">
              <Field label="Account number"><input name="accountNumber" inputMode="numeric" autoComplete="off" required /></Field>
              <Field label="Again"><input name="accountNumberAgain" inputMode="numeric" autoComplete="off" required /></Field>
              <Field label="IFSC"><input name="ifsc" required placeholder="SBIN0001234" /></Field>
              <Field label="PAN"><input name="pan" required /></Field>
            </div>
            <Field label="Email"><input name="email" type="email" required defaultValue={d.email ?? ''} /></Field>
            <Field label="Address"><input name="street" required /></Field>
            <div className="grid3">
              <Field label="City"><input name="city" required /></Field>
              <Field label="State"><input name="state" required defaultValue="Andhra Pradesh" /></Field>
              <Field label="PIN"><input name="pin" required /></Field>
            </div>
          </ActionForm>
        ) : null}
      </section>
    </div>
  );
}

async function HistoryTab({ id }: { id: string }) {
  const h = await load<{ id: string; at: string; actorType: string; actorName: string | null; action: string; before: unknown; after: unknown }[]>(`/v1/admin/doctors/${id}/history`, { limit: 50 });
  if (h.error) return <LoadError error={h.error} />;
  return (
    <ol className="timeline">
      {h.data.map((e) => (
        <li key={e.id}>
          <div className="when">{dateTime(e.at)} · {e.actorName ?? e.actorType}</div>
          <div>{words(e.action.replace(/^doctor\./, ''))}</div>
          {e.after ? (
            <details className="raw">
              <summary>Details</summary>
              <pre>{JSON.stringify({ before: e.before, after: e.after }, null, 2)}</pre>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
