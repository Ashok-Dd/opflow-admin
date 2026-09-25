import QRCode from 'qrcode';

import { ActionForm, Field } from '@/components/action-form';
import { ApiError, api } from '@/lib/api';

import { completeSetup } from '../../actions';

export const metadata = { title: 'Set up your account' };

export default async function Setup({ params }: PageProps<'/setup/[token]'>) {
  const { token } = await params;
  let info: { email: string; name: string; totpSecret: string; otpauthUrl: string } | null = null;
  let error: string | null = null;
  try {
    info = await api('GET', `/v1/admin/auth/setup/${encodeURIComponent(token)}`, { anonymous: true });
  } catch (err) {
    error = err instanceof ApiError ? err.message : 'This setup link cannot be opened.';
  }
  const svg = info ? await QRCode.toString(info.otpauthUrl, { type: 'svg', margin: 1, color: { dark: '#17221d', light: '#ffffff' } }) : '';

  return (
    <main className="gate">
      <section className="pass" style={{ maxWidth: 460 }}>
        <h1>Set up your admin account</h1>
        {error || !info ? (
          <div className="notice bad">{error}</div>
        ) : (
          <>
            <p className="lead">
              For <b>{info.name}</b> ({info.email}). This link works once, for 24 hours.
            </p>
            <h3 style={{ font: '500 15px var(--serif)', margin: '0 0 6px' }}>1 · Scan with an authenticator app</h3>
            <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="faint" style={{ fontSize: 12, wordBreak: 'break-all' }}>
              Can&apos;t scan? Type this key: <span className="mono">{info.totpSecret.replace(/(.{4})/g, '$1 ').trim()}</span>
            </p>
            <h3 style={{ font: '500 15px var(--serif)', margin: '14px 0 6px' }}>2 · Choose a password and enter the code</h3>
            <ActionForm action={completeSetup} submit="Finish setup" hidden={{ token }}>
              <Field label="Password" hint="12 or more letters and numbers">
                <input name="password" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Field label="Password again">
                <input name="password2" type="password" autoComplete="new-password" minLength={12} required />
              </Field>
              <Field label="6-digit code from the app">
                <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required className="mono" />
              </Field>
            </ActionForm>
          </>
        )}
      </section>
    </main>
  );
}
