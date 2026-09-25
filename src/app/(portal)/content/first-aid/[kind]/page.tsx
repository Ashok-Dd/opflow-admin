import { ActionForm, Field } from '@/components/action-form';
import { Head, LoadError, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime } from '@/lib/format';

import { publishFirstAid, saveFirstAid } from '../../../actions';
import type { Guide } from '../page';

export default async function FirstAidEdit({ params }: PageProps<'/content/first-aid/[kind]'>) {
  const { kind } = await params;
  const [g, cat] = await Promise.all([load<Guide[]>('/v1/admin/first-aid'), load<{ emergencyKinds: { id: string; name: string; detail: string }[] }>('/v1/catalog')]);
  if (g.error) return (<><Head title="First aid" /><LoadError error={g.error} /></>);
  const x = g.data.find((i) => i.kindId === kind);
  const k = cat.data?.emergencyKinds.find((i) => i.id === kind);
  const list = (v: string[] | undefined) => (v ?? []).join('\n');
  return (
    <>
      <Head kicker="First aid" title={k?.name ?? kind} lead={k?.detail}>
        <Stamp s={x?.status ?? 'draft'} />
      </Head>
      <div className="cols">
        <section className="slip">
          <h3>Content</h3>
          <p className="faint" style={{ marginTop: 0 }}>One point per line. Simple words. No medicine doses, no home remedies.</p>
          <ActionForm action={saveFirstAid} submit="Save (goes back to review)" hidden={{ kind }}>
            <Field label="Short intro" hint="optional"><textarea name="intro" defaultValue={x?.intro ?? ''} maxLength={600} /></Field>
            <Field label="Signs to look for" hint="optional"><textarea name="signs" defaultValue={list(x?.signs)} /></Field>
            <Field label="Call 108 now if…"><textarea name="callNowIf" required defaultValue={list(x?.callNowIf)} /></Field>
            <Field label="Do"><textarea name="dos" required rows={6} defaultValue={list(x?.dos)} /></Field>
            <Field label="Don't"><textarea name="donts" required rows={6} defaultValue={list(x?.donts)} /></Field>
            <Field label="WHO sources" hint="one per line: title | year | link">
              <textarea name="sources" required defaultValue={(x?.sources ?? []).map((s) => [s.title, s.year ?? '', s.url ?? ''].join(' | ')).join('\n')} />
            </Field>
            <label className="actions" style={{ marginBottom: 12 }}>
              <input type="checkbox" name="sourceToConfirm" defaultChecked={x?.sourceToConfirm ?? true} /> The exact WHO document is still being confirmed
            </label>
          </ActionForm>
        </section>
        <div>
          <section className="slip">
            <h3>Publish</h3>
            {x?.status === 'published' ? (
              <p>Published {dateTime(x.publishedAt)}, reviewed by <b>{x.reviewedByDoctor}</b>.</p>
            ) : x?.sourceToConfirm ? (
              <div className="notice warn">Confirm the WHO source first (untick the box and save).</div>
            ) : (
              <ActionForm action={publishFirstAid} submit="Publish to the app" hidden={{ kind }} confirm="A doctor has reviewed this page against its WHO source?">
                <Field label="Reviewed by (doctor's full name)"><input name="reviewedByDoctor" minLength={5} required placeholder="Dr. …" /></Field>
              </ActionForm>
            )}
          </section>
          <section className="slip">
            <h3>How the phone shows it</h3>
            <div style={{ fontSize: 13 }}>
              {x?.intro ? <p>{x.intro}</p> : null}
              <b style={{ color: 'var(--alarm)' }}>Call 108 now if</b>
              <ul>{x?.callNowIf.map((t) => <li key={t}>{t}</li>)}</ul>
              <b style={{ color: 'var(--fern)' }}>Do</b>
              <ul>{x?.dos.map((t) => <li key={t}>{t}</li>)}</ul>
              <b style={{ color: 'var(--alarm)' }}>Don&apos;t</b>
              <ul>{x?.donts.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
