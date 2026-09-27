import { ActionForm, Field } from '@/components/action-form';
import { sp } from '@/components/ui';

import { signIn } from '../actions';

export const metadata = { title: 'Sign in' };

export default async function SignIn({ searchParams }: PageProps<'/sign-in'>) {
  const q = sp(await searchParams);
  return (
    <main className="gate">
      <section className="pass">
        <h1>OPflow admin</h1>
        <p className="lead">For the OPflow admin only. There is no sign-up.</p>
        {q.expired ? <div className="notice warn">You were signed out. Please sign in again.</div> : null}
        {q.ready ? <div className="notice">Your account is ready. Sign in with your new password.</div> : null}
        <ActionForm action={signIn} submit="Continue" busy="Checking…" hidden={{ next: q.next ?? '/' }}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <input name="password" type="password" autoComplete="current-password" required />
          </Field>
        </ActionForm>
      </section>
    </main>
  );
}
