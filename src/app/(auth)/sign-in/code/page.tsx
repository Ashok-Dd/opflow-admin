import { ActionForm, Field } from '@/components/action-form';
import { sp } from '@/components/ui';

import { verifyCode } from '../../actions';

export const metadata = { title: 'Authenticator code' };

export default async function Code({ searchParams }: PageProps<'/sign-in/code'>) {
  const q = sp(await searchParams);
  return (
    <main className="gate">
      <section className="pass">
        <h1>Authenticator code</h1>
        <p className="lead">Open your authenticator app and enter the 6-digit code for OPflow Admin.</p>
        <ActionForm action={verifyCode} submit="Sign in" hidden={{ next: q.next ?? '/' }}>
          <Field label="Code">
            <input
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              autoFocus
              className="mono"
              style={{ fontSize: 22, letterSpacing: '0.4em', textAlign: 'center' }}
            />
          </Field>
        </ActionForm>
        <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
          Five wrong tries lock the account for 15 minutes. <a href="/sign-in">Start again</a>
        </p>
      </section>
    </main>
  );
}
