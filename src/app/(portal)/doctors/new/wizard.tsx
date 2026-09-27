'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

import { useConfirm } from '@/components/confirm';

import { OpLoadingScreen } from '@/components/op-loader';

import { Field } from '@/components/action-form';

import { createDoctor } from '../../actions';

const STEPS = ['Identity', 'Registration', 'Hospitals & fee', 'Payout', 'About'];

/** The half-filled wizard, kept in this browser only (one admin, one machine). Cleared once the doctor is created. */
const DRAFT_KEY = 'opflow.admin.doctorDraft';
type Draft = { step: number; savedAt: string; values: Record<string, string | string[]> };
type Errors = Record<string, string>;

const val = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Same rules as the API (admin.controller createDoctorBody), checked one step at a time. */
function checkStep(step: number, f: FormData): Errors {
  const e: Errors = {};
  if (step === 0) {
    const name = val(f, 'name');
    if (name.length < 3) e.name = 'Please write the full name (at least 3 letters).';
    else if (name.length > 80) e.name = 'Name is too long (80 letters at most).';
    if (!val(f, 'gender')) e.gender = 'Please choose the gender.';
    const phone = val(f, 'phone').replace(/[\s-]/g, '');
    if (!phone) e.phone = 'Mobile number is needed; the password goes there by SMS.';
    else if (!/^(\+?91)?[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
    const email = val(f, 'email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'This email does not look right.';
  }
  if (step === 1) {
    if (!val(f, 'typeId')) e.typeId = 'Please choose the type of doctor.';
    const degrees = val(f, 'degrees');
    if (degrees.length < 2) e.degrees = 'Please write the degrees.';
    else if (degrees.length > 120) e.degrees = 'Too long (120 letters at most).';
    const council = val(f, 'regCouncil');
    if (council.length < 2) e.regCouncil = 'Please write the medical council.';
    else if (council.length > 60) e.regCouncil = 'Too long (60 letters at most).';
    const regNo = val(f, 'regNo');
    if (regNo.length < 2) e.regNo = 'Please write the registration number.';
    else if (regNo.length > 40) e.regNo = 'Too long (40 letters at most).';
    const year = val(f, 'regYear');
    const thisYear = new Date().getFullYear();
    if (year && (!/^\d{4}$/.test(year) || +year < 1950 || +year > thisYear)) e.regYear = `Enter a year between 1950 and ${thisYear}.`;
    const years = val(f, 'years');
    if (years && (!/^\d{1,2}$/.test(years) || +years > 70)) e.years = 'Enter a number from 0 to 70.';
  }
  if (step === 2) {
    const hospitals = f.getAll('hospitalId');
    if (!hospitals.length) e.hospitalId = 'Tick at least one hospital the doctor works at.';
    else if (hospitals.length > 10) e.hospitalId = '10 hospitals at most.';
    const fee = val(f, 'fee').replace(/[₹,\s]/g, '');
    if (!fee) e.fee = 'Please enter the fee.';
    else if (!/^\d+$/.test(fee) || +fee < 50 || +fee > 3000) e.fee = 'Fee must be a whole number from ₹50 to ₹3,000.';
    const langs = val(f, 'languages').split(',').map((s) => s.trim()).filter(Boolean);
    if (langs.length > 8) e.languages = '8 languages at most.';
    else if (langs.some((l) => l.length < 2 || l.length > 20)) e.languages = 'Each language should be 2 to 20 letters.';
  }
  if (step === 4 && val(f, 'about').length > 240) e.about = '240 letters at most.';
  return e;
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/**
 * The 5-step "Add a doctor" wizard. All steps are one form (values survive going back and forth).
 * Each step is checked on "Next" and its mistakes are shown right there; every finished step is saved as a draft.
 * Nothing is created until "Create doctor". No documents: the registration number is checked on the council's site.
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
  const ask = useConfirm();
  const approved = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [fee, setFee] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [draftAt, setDraftAt] = useState<string | null>(null);

  // Put a saved draft back into the form once, after the first render.
  useEffect(() => {
    const d = readDraft();
    const form = formRef.current;
    if (!d || !form) return;
    for (const [k, v] of Object.entries(d.values)) {
      if (k === 'hospitalId') continue;
      const el = form.elements.namedItem(k);
      if (el instanceof RadioNodeList) {
        for (const r of Array.from(el)) if (r instanceof HTMLInputElement) r.checked = r.value === v;
      } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.value = String(v);
      }
    }
    const ticked = ([] as string[]).concat(d.values.hospitalId ?? []);
    form.querySelectorAll<HTMLInputElement>('input[name="hospitalId"]').forEach((c) => (c.checked = ticked.includes(c.value)));
    setPicked(ticked);
    setFee(String(d.values.fee ?? ''));
    setStep(Math.min(Math.max(d.step, 0), STEPS.length - 1));
    setDraftAt(d.savedAt);
  }, []);

  useEffect(() => {
    if (!state?.ok) return;
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [state]);

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

  const saveDraft = (nextStep: number) => {
    const form = formRef.current;
    if (!form) return;
    const f = new FormData(form);
    const values: Draft['values'] = {};
    for (const k of new Set(f.keys())) {
      const all = f.getAll(k).map(String);
      values[k] = k === 'hospitalId' ? all : all[0];
    }
    const savedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: nextStep, savedAt, values } satisfies Draft));
      setDraftAt(savedAt);
    } catch {}
  };

  /** Check steps `from`..`to`; show the first wrong step with its mistakes. True when all are fine. */
  const check = (from: number, to: number) => {
    const form = formRef.current;
    if (!form) return false;
    const f = new FormData(form);
    for (let i = from; i <= to; i++) {
      const e = checkStep(i, f);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        requestAnimationFrame(() => form.querySelector<HTMLElement>('.has-err input, .has-err select, .has-err textarea, .step-err')?.focus());
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const next = () => {
    if (!check(step, step)) return;
    saveDraft(step + 1);
    setStep(step + 1);
  };

  const back = () => {
    setErrors({});
    saveDraft(step - 1);
    setStep(step - 1);
  };

  const discardDraft = () => {
    void ask
      .confirm({ title: 'Throw away this draft?', text: 'Everything filled so far is cleared and you start again from Identity.', yes: 'Yes, start fresh', danger: true })
      .then((ok) => {
        if (!ok) return;
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {}
        formRef.current?.reset();
        setFee('');
        setPicked([]);
        setErrors({});
        setDraftAt(null);
        setStep(0);
      });
  };

  const err = (k: string) => errors[k];

  return (
    // noValidate: each step is checked by checkStep on "Next"; the API still checks everything again.
    <form
      ref={formRef}
      action={run}
      noValidate
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (name && errors[name])
          setErrors((prev) => {
            const rest = { ...prev };
            delete rest[name];
            return rest;
          });
      }}
      onSubmit={(e) => {
        if (approved.current) {
          approved.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        if (!check(0, STEPS.length - 1)) return;
        saveDraft(step);
        void ask
          .confirm({ title: 'Create this doctor?', text: 'An OPD ID and a first password are made now. Please check the details once more.', yes: 'Yes, create doctor' })
          .then((ok) => {
            if (!ok) return;
            approved.current = true;
            form.requestSubmit();
          });
      }}
    >
      {ask.dialog}
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'now' : i < step ? 'done' : ''}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            {s}
          </li>
        ))}
      </ol>

      {draftAt ? (
        <div className="notice" style={{ maxWidth: 760, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>
            Draft saved {new Date(draftAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. It stays in this browser until the doctor is created.
          </span>
          <button type="button" className="btn ghost small" onClick={discardDraft}>Start fresh</button>
        </div>
      ) : null}

      <div className="slip" style={{ maxWidth: 760 }}>
        <div style={show(0)}>
          <h3>Who is the doctor?</h3>
          <Field label="Full name" hint="exactly as on the registration" error={err('name')}>
            <input name="name" required minLength={3} maxLength={80} />
          </Field>
          <div className="grid2">
            <Field label="Gender" error={err('gender')}>
              <select name="gender" required defaultValue="">
                <option value="" disabled>Choose</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Mobile number" hint="10 digits, gets the password by SMS" error={err('phone')}>
              <input name="phone" inputMode="tel" pattern="(\+91)?[6-9]\d{9}" required placeholder="98xxxxxx10" />
            </Field>
          </div>
          <Field label="Email" hint="gets the login ID" error={err('email')}>
            <input name="email" type="email" />
          </Field>
        </div>

        <div style={show(1)}>
          <h3>Registration</h3>
          <div className="grid2">
            <Field label="Type of doctor" error={err('typeId')}>
              <select name="typeId" required defaultValue="">
                <option value="" disabled>Choose</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.simpleName} ({t.properName})</option>
                ))}
              </select>
            </Field>
            <Field label="Degrees" error={err('degrees')}>
              <input name="degrees" required placeholder="MBBS, MD (Pediatrics)" />
            </Field>
            <Field label="Medical council" error={err('regCouncil')}>
              <input name="regCouncil" required placeholder="APMC or NMC" />
            </Field>
            <Field label="Registration number" error={err('regNo')}>
              <input name="regNo" required />
            </Field>
            <Field label="Year of registration" hint="optional" error={err('regYear')}>
              <input name="regYear" inputMode="numeric" pattern="\d{4}" />
            </Field>
            <Field label="Years of experience" error={err('years')}>
              <input name="years" inputMode="numeric" pattern="\d{1,2}" />
            </Field>
          </div>
          <div className="notice">
            Check the number on the council&apos;s website before going on:{' '}
            <a href="https://www.nmc.org.in/information-desk/indian-medical-register/" target="_blank" rel="noreferrer">NMC register</a>. The same council + number can&apos;t be added twice.
          </div>
        </div>

        <div style={show(2)}>
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
          {err('hospitalId') ? <p className="step-err" role="alert" tabIndex={-1}>{err('hospitalId')}</p> : null}
          <p className="faint" style={{ marginTop: 0 }}>Hospital missing? <a href="/hospitals/new" target="_blank">Add it</a>, then reload this page (your draft is kept).</p>
          <div className="grid2">
            <Field label="Doctor's fee (₹)" hint="₹50 – ₹3,000" error={err('fee')}>
              <input name="fee" inputMode="numeric" required value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
            <Field label="Languages" hint="comma separated" error={err('languages')}>
              <input name="languages" placeholder="Telugu, English" />
            </Field>
          </div>
          {feeNum > 0 ? (
            <p className="mono" style={{ margin: 0 }}>
              Doctor gets ₹{(feeNum - Math.floor(feeNum * 10) / 100).toLocaleString('en-IN')} · OPflow ₹{(Math.floor(feeNum * 10) / 100).toLocaleString('en-IN')}
            </p>
          ) : null}
        </div>

        <div style={show(3)}>
          <h3>Payout</h3>
          <p className="muted">
            The doctor&apos;s bank account (Cashfree Payouts) is added from the doctor page after creation, with a fresh authenticator code. Bookings can open before it is active; the doctor&apos;s money waits until it is.
          </p>
        </div>

        <div style={show(4)}>
          <h3>About (optional)</h3>
          <Field label="About the doctor" hint="up to 240 letters; the doctor can change it in the app" error={err('about')}>
            <textarea name="about" maxLength={240} />
          </Field>
          <p className="faint">The photo is added by the doctor from the app (clear face, plain background).</p>
        </div>

        <div className="actions" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" disabled={step === 0} onClick={back}>← Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={next}>Next: {STEPS[step + 1]} →</button>
          ) : (
            <button className="btn" disabled={pending}>{pending ? 'Creating…' : 'Create doctor'}</button>
          )}
        </div>
        {pending ? <OpLoadingScreen message="Creating the doctor…" detail="Making the OPD ID and the first password" /> : null}
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
