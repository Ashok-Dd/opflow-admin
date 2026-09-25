import { ActionForm } from '@/components/action-form';
import { Empty, Head, LoadError, sp, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago, words } from '@/lib/format';

import { ticketCommand } from '../actions';

export const metadata = { title: 'Support' };

const REPLIES = [
  'Thank you for writing. We have checked your booking and everything is in order.',
  'Your money back has started. Banks can take 5–7 working days to show it.',
  'We are sorry for the trouble. The OPflow team is looking into it and will write again today.',
];

export default async function SupportPage({ searchParams }: PageProps<'/support'>) {
  const q = sp(await searchParams);
  const status = q.status ?? 'open';
  const r = await load<{ id: string; message: string; status: string; requestId: string | null; createdAt: string; userId: string | null; assignedTo: string | null; fromName: string | null; fromRole: string }[]>('/v1/admin/tickets', { status: status === 'all' ? undefined : status, limit: 50 });
  return (
    <>
      <Head kicker="Help" title="Support" lead="Messages from patients and doctors in the app. Your reply arrives in their Messages tab. Write it in simple English." />
      <div className="tabs">
        {['open', 'answered', 'closed', 'all'].map((s) => (
          <a key={s} href={`?status=${s}`} aria-current={s === status ? 'page' : undefined}>{words(s)}</a>
        ))}
      </div>
      {r.error ? <LoadError error={r.error} /> : null}
      {r.data?.length === 0 ? <Empty title="No tickets here." /> : null}
      <datalist id="replies">{REPLIES.map((x) => <option key={x} value={x} />)}</datalist>
      {r.data?.map((t) => (
        <section key={t.id} className="slip">
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <b>{t.fromName ?? 'Someone'} <span className="faint">· {t.fromRole} · {ago(t.createdAt)}</span></b>
            <Stamp s={t.status} />
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{t.message}</p>
          {t.requestId ? <p className="faint mono" style={{ fontSize: 11.5 }}>request {t.requestId}</p> : null}
          {t.status !== 'closed' ? (
            <div className="grid2">
              <ActionForm action={ticketCommand} submit="Send reply" hidden={{ id: t.id, cmd: 'reply' }} resetOnOk>
                <input name="reply" list="replies" required minLength={2} maxLength={500} placeholder="Type or pick a ready reply" style={{ marginBottom: 8 }} />
              </ActionForm>
              <ActionForm action={ticketCommand} submit="Close" hidden={{ id: t.id, cmd: 'close' }} />
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
