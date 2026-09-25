'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { Field } from '@/components/action-form';

import { createDoctor, documentUploadUrl } from '../../actions';

const STEPS = ['Identity', 'Registration', 'Documents', 'Hospitals & fee', 'Payout', 'Photo & about'];
const DOCS = [
  { kind: 'degree', label: 'Degree certificate' },
  { kind: 'registration', label: 'Registration certificate' },
  { kind: 'id_proof', label: 'Government ID (Aadhaar masked / PAN / passport)' },
];

/**
 * The 6-step "Add a doctor" wizard. All steps are one form (values survive going back and forth);
 * nothing is created until "Create doctor". Documents go straight from this browser to private storage.
 */
export function DoctorWizard({
  types,
  hospitals,
}: {
  types: { id: string; simpleName: string; properName: string }[];
  hospitals: { id: string; name: string; area: string; city: string }[];
}) {
  const [step, setStep] = useState(0);
  const [state, run, pending] = useActionState(createDoctor, null);
  const [docs, setDocs] = useState<Record<string, { key?: string; name?: string; busy?: boolean; error?: string }>>({});
  const [fee, setFee] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setDocs((d) => ({ ...d, [kind]: { error: 'This file is over 10 MB.' } }));
    setDocs((d) => ({ ...d, [kind]: { busy: true, name: file.name } }));
    const link = await documentUploadUrl(file.type || 'application/pdf');
    if ('error' in link) return setDocs((d) => ({ ...d, [kind]: { error: link.error } }));
    const res = await fetch(link.url, { method: 'PUT', headers: link.headers, body: file }).catch(() => null);
    if (!res?.ok) return setDocs((d) => ({ ...d, [kind]: { error: 'Upload failed. Please try again.' } }));
    setDocs((d) => ({ ...d, [kind]: { key: link.key, name: file.name } }));
  }

  if (state?.ok && state.data) {
    return (
      <section className="slip" style={{ maxWidth: 620 }}>
        <h3>Doctor created</h3>
        <dl>
          <dt>Login ID</dt>
          <dd className="mono" style={{ fontSize: 18 }}>{state.data.loginId}</dd>
          <dt>One-time password</dt>
          <dd className="mono" style={{ fontSize: 18 }}>{state.data.oneTimePassword}</dd>
        </dl>
        <div className="notice warn">
          This password is shown <b>only now</b>. It was also sent by SMS; the login ID went by email. Read it out on the phone only if the SMS did not arrive. The doctor chooses their own password at first login.
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <a className="btn" href={`/doctors/${state.data.doctorId}`}>Open the doctor page</a>
          <Link className="btn ghost" href="/doctors/new">Add another</Link>
        </div>
      </section>
    );
  }

  const feeNum = Number(fee.replace(/[₹,\s]/g, '')) || 0;
  const show = (i: number) => ({ display: step === i ? 'block' : 'none' });

  return (
    // noValidate: fields on hidden steps can't show the browser's messages; the API returns each wrong field.
    <form action={run} noValidate>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'now' : i < step ? 'done' : ''}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            {s}
          </li>
        ))}
      </ol>

      <div className="slip" style={{ maxWidth: 760 }}>
        <div style={show(0)}>
          <h3>Who is the doctor?</h3>
          <Field label="Full name" hint="exactly as on the registration">
            <input name="name" required minLength={3} maxLength={80} />
          </Field>
          <div className="grid2">
            <Field label="Gender">
              <select name="gender" required defaultValue="">
                <option value="" disabled>Choose</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Mobile number" hint="10 digits, gets the password by SMS">
              <input name="phone" inputMode="tel" pattern="(\+91)?[6-9]\d{9}" required placeholder="98xxxxxx10" />
            </Field>
          </div>
          <Field label="Email" hint="gets the login ID">
            <input name="email" type="email" />
          </Field>
        </div>

        <div style={show(1)}>
          <h3>Registration</h3>
          <div className="grid2">
            <Field label="Type of doctor">
              <select name="typeId" required defaultValue="">
                <option value="" disabled>Choose</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.simpleName} ({t.properName})</option>
                ))}
              </select>
            </Field>
            <Field label="Degrees">
              <input name="degrees" required placeholder="MBBS, MD (Pediatrics)" />
            </Field>
            <Field label="Medical council">
              <input name="regCouncil" required placeholder="APMC or NMC" />
            </Field>
            <Field label="Registration number">
              <input name="regNo" required />
            </Field>
            <Field label="Year of registration" hint="optional">
              <input name="regYear" inputMode="numeric" pattern="\d{4}" />
            </Field>
            <Field label="Years of experience">
              <input name="years" inputMode="numeric" pattern="\d{1,2}" />
            </Field>
          </div>
          <div className="notice">
            Check the number on the council&apos;s website before going on:{' '}
            <a href="https://www.nmc.org.in/information-desk/indian-medical-register/" target="_blank" rel="noreferrer">NMC register</a>. The same council + number can&apos;t be added twice.
          </div>
        </div>

        <div style={show(2)}>
          <h3>Documents</h3>
          <p className="muted" style={{ marginTop: 0 }}>PDF, JPG or PNG, up to 10 MB each. Stored privately; only admins open them, with 5-minute links.</p>
          {DOCS.map((d) => (
            <Field key={d.kind} label={d.label}>
              <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => upload(d.kind, e.target.files?.[0])} />
              <input type="hidden" name={`doc_${d.kind}`} value={docs[d.kind]?.key ?? ''} />
              {docs[d.kind]?.busy ? <span className="faint">Uploading…</span> : null}
              {docs[d.kind]?.key ? <span className="result ok">Uploaded: {docs[d.kind]?.name}</span> : null}
              {docs[d.kind]?.error ? <span className="err">{docs[d.kind]?.error}</span> : null}
            </Field>
          ))}
        </div>

        <div style={show(3)}>
          <h3>Hospitals and fee</h3>
          <table className="register" style={{ marginBottom: 12 }}>
            <thead>
              <tr><th>Works here</th><th>Hospital</th><th>Main one</th></tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id}>
                  <td>
                    <input
                      type="checkbox"
                      name="hospitalId"
                      value={h.id}
                      onChange={(e) => setPicked((p) => (e.target.checked ? [...p, h.id] : p.filter((x) => x !== h.id)))}
                    />
                  </td>
                  <td>{h.name}<span className="sub">{h.area}, {h.city}</span></td>
                  <td><input type="radio" name="primaryHospital" value={h.id} disabled={!picked.includes(h.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="faint" style={{ marginTop: 0 }}>Hospital missing? <a href="/hospitals/new" target="_blank">Add it</a>, then reload this page.</p>
          <div className="grid2">
            <Field label="Doctor's fee (₹)" hint="₹50 – ₹3,000">
              <input name="fee" inputMode="numeric" required value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
            <Field label="Languages" hint="comma separated">
              <input name="languages" placeholder="Telugu, English" />
            </Field>
          </div>
          {feeNum > 0 ? (
            <p className="mono" style={{ margin: 0 }}>
              Doctor gets ₹{(feeNum - Math.floor(feeNum * 10) / 100).toLocaleString('en-IN')} · OPflow ₹{(Math.floor(feeNum * 10) / 100).toLocaleString('en-IN')}
            </p>
          ) : null}
        </div>

        <div style={show(4)}>
          <h3>Payout</h3>
          <p className="muted">
            The doctor&apos;s bank account (Razorpay Route) is added from the doctor page after creation, with a fresh authenticator code. Bookings can open before it is active; the doctor&apos;s money waits until it is.
          </p>
        </div>

        <div style={show(5)}>
          <h3>About (optional)</h3>
          <Field label="About the doctor" hint="up to 240 letters; the doctor can change it in the app">
            <textarea name="about" maxLength={240} />
          </Field>
          <p className="faint">The photo is added by the doctor from the app (clear face, plain background).</p>
        </div>

        <div className="actions" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={() => setStep((s) => s + 1)}>Next: {STEPS[step + 1]} →</button>
          ) : (
            <button className="btn" disabled={pending}>{pending ? 'Creating…' : 'Create doctor'}</button>
          )}
        </div>
        {state && !state.ok ? (
          <div className="result bad" role="status">
            {state.message}
            {state.fields ? (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {Object.entries(state.fields).map(([k, v]) => (
                  <li key={k}><span className="mono">{k}</span>: {v}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
