'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';

import type { ActionResult } from '@/lib/actions';

type ServerAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * Every admin change goes through this form. It shows what happened in place, lists wrong fields, asks
 * for confirmation when told to, and, when the API wants a fresh authenticator code, shows the code box
 * and sends the same form again with it.
 */
export function ActionForm({
  action,
  children,
  submit,
  confirm,
  danger,
  small,
  inline,
  hidden,
  resetOnOk,
}: {
  action: ServerAction;
  children?: ReactNode;
  submit: string;
  confirm?: string;
  danger?: boolean;
  small?: boolean;
  inline?: boolean;
  hidden?: Record<string, string>;
  resetOnOk?: boolean;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const needCode = state && !state.ok && state.code === 'STEP_UP_REQUIRED';

  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form
      ref={ref}
      action={run}
      onSubmit={(e) => {
        if (confirm && !needCode && !window.confirm(confirm)) e.preventDefault();
      }}
      style={inline ? { display: 'inline-block' } : undefined}
    >
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {needCode ? (
        <div className="stepup">
          <label>
            Authenticator code
            <input name="stepUpCode" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" autoFocus required />
          </label>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>This action needs a fresh code (valid for 5 minutes after you enter it).</div>
        </div>
      ) : null}
      <div className="actions" style={{ marginTop: children ? 4 : 0 }}>
        <button className={`btn${danger ? ' danger' : ''}${small ? ' small' : ''}`} disabled={pending}>
          {pending ? 'Working…' : needCode ? `Confirm and ${submit.toLowerCase()}` : submit}
        </button>
      </div>
      {state && !needCode ? (
        <div className={`result ${state.ok ? 'ok' : 'bad'}`} role="status">
          {state.ok ? (state.message ?? 'Done.') : state.message}
          {!state.ok && state.fields ? (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {Object.entries(state.fields).map(([k, v]) => (
                <li key={k}>
                  <span className="mono">{k}</span>: {v}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** A label + input pair. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label} {hint ? <i>· {hint}</i> : null}
      </span>
      {children}
    </label>
  );
}
