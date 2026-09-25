import { Head, LoadError, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'First aid' };

export interface Guide {
  kindId: string;
  intro: string | null;
  signs: string[];
  callNowIf: string[];
  dos: string[];
  donts: string[];
  sources: { title: string; year?: number | null; url?: string | null }[];
  sourceToConfirm: boolean;
  status: string;
  reviewedByDoctor: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export default async function FirstAidList() {
  const [g, cat] = await Promise.all([load<Guide[]>('/v1/admin/first-aid'), load<{ emergencyKinds: { id: string; name: string }[] }>('/v1/catalog')]);
  const names = new Map((cat.data?.emergencyKinds ?? []).map((k) => [k.id, k.name]));
  return (
    <>
      <Head
        kicker="Content"
        title="Emergency first aid"
        lead="Do's and Don'ts for each emergency, from WHO sources. A page is shown in the app only after a named doctor reviews it and its WHO source is confirmed. Any edit sends it back to review."
      />
      {g.error ? <LoadError error={g.error} /> : (
        <table className="register">
          <thead><tr><th>Emergency</th><th>Status</th><th>WHO source</th><th>Reviewed by</th><th>Changed</th></tr></thead>
          <tbody>
            {g.data.map((x) => (
              <tr key={x.kindId}>
                <td><a className="rowlink" href={`/content/first-aid/${x.kindId}`}>{names.get(x.kindId) ?? x.kindId}</a></td>
                <td><Stamp s={x.status} /></td>
                <td>{x.sourceToConfirm ? <Stamp s="pending" label="to confirm" /> : <span className="muted">{x.sources[0]?.title}</span>}</td>
                <td>{x.reviewedByDoctor ?? <span className="faint">not yet</span>}</td>
                <td className="muted">{dateTime(x.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
