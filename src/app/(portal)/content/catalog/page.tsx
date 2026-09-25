import { Head, LoadError, Sec } from '@/components/ui';
import { load } from '@/lib/api';

export const metadata = { title: 'Catalog' };

interface Type { id: string; simpleName: string; properName: string; icon: string; sort: number; isCommon: boolean }
interface Problem { id: string; name: string; isDanger: boolean; map: { typeId: string; audience: string; rank: number }[] }
interface Kind { id: string; name: string; detail: string; typeIds: string[] }

/** What the app's menus are made of. Changes reach phones at their next catalog refresh (about a minute). */
export default async function CatalogPage() {
  const [types, problems, kinds] = await Promise.all([
    load<Type[]>('/v1/admin/catalog/types'),
    load<Problem[]>('/v1/admin/catalog/problems'),
    load<Kind[]>('/v1/admin/catalog/emergency-kinds'),
  ]);
  return (
    <>
      <Head kicker="Content" title="Catalog" lead="Types of doctor, health problems (and which doctor to see for adults and children), and emergency situations, exactly as the app shows them." />
      <Sec title="Types of doctor" note={types.data ? `${types.data.length}` : undefined} />
      {types.error ? <LoadError error={types.error} /> : (
        <table className="register">
          <thead><tr><th>Id</th><th>Patients read</th><th>Proper name</th><th>On Home</th></tr></thead>
          <tbody>
            {types.data.map((t) => (
              <tr key={t.id}><td className="mono">{t.id}</td><td>{t.simpleName}</td><td className="muted">{t.properName}</td><td>{t.isCommon ? '✓' : ''}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <Sec title="Health problems" note={problems.data ? `${problems.data.length}` : undefined} />
      {problems.error ? <LoadError error={problems.error} /> : (
        <table className="register">
          <thead><tr><th>Problem</th><th>Adults see</th><th>Children see</th></tr></thead>
          <tbody>
            {problems.data.map((p) => (
              <tr key={p.id}>
                <td>{p.name}{p.isDanger ? <span className="sub" style={{ color: 'var(--alarm)' }}>may be an emergency</span> : null}</td>
                <td className="mono">{p.map.filter((m) => m.audience === 'adult').sort((a, b) => a.rank - b.rank).map((m) => m.typeId).join(', ')}</td>
                <td className="mono">{p.map.filter((m) => m.audience === 'child').sort((a, b) => a.rank - b.rank).map((m) => m.typeId).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Sec title="Emergency situations" note={kinds.data ? `${kinds.data.length}` : undefined} />
      {kinds.error ? <LoadError error={kinds.error} /> : (
        <table className="register">
          <thead><tr><th>Situation</th><th>Doctors who help</th></tr></thead>
          <tbody>
            {kinds.data.map((k) => (
              <tr key={k.id}><td>{k.name}<span className="sub">{k.detail}</span></td><td className="mono">{k.typeIds.join(', ')}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
