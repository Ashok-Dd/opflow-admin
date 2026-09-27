import { ActionForm } from '@/components/action-form';
import { Head, LoadError, Sec, Stamp } from '@/components/ui';
import { load } from '@/lib/api';
import { ago } from '@/lib/format';
import { me } from '@/lib/me';

import { killSwitch, saveRule } from '../../actions';

export const metadata = { title: 'Rules & switches' };

interface Rule { key: string; value: unknown; description: string | null; updatedAt: string; killSwitch: boolean }

export default async function RulesPage() {
  const [who, r] = await Promise.all([me(), load<Rule[]>('/v1/admin/config')]);
  const canAsk = who.role === 'super' || who.role === 'ops';
  const switches = r.data?.filter((x) => x.killSwitch) ?? [];
  const rules = r.data?.filter((x) => !x.killSwitch) ?? [];
  return (
    <>
      <Head kicker="Settings" title="Rules & switches" lead="Switches stop a feature for everyone (for example bookings during a payment outage). Every change asks for your authenticator code and is written to the audit log." />
      {r.error ? <LoadError error={r.error} /> : null}

      <Sec title="Kill switches" />
      <table className="register">
        <thead><tr><th>Switch</th><th>Now</th><th>Changed</th><th /></tr></thead>
        <tbody>
          {switches.map((s) => (
            <tr key={s.key}>
              <td className="mono">{s.key}<span className="sub" style={{ fontFamily: 'var(--sans)' }}>{s.description}</span></td>
              <td><Stamp s={s.value === true ? 'active' : 'cancelled'} label={s.value === true ? 'on' : 'off'} /></td>
              <td className="muted">{ago(s.updatedAt)}</td>
              <td>
                {canAsk ? (
                  s.value === true ? (
                    <ActionForm action={killSwitch} submit="Turn OFF now" small danger inline hidden={{ key: s.key }} confirm={{ title: `Turn OFF ${s.key}?`, text: 'This switches it off for everyone right away.', yes: 'Yes, turn off' }}>
                      <input name="reason" required minLength={5} placeholder="Why" style={{ width: 200, marginRight: 6 }} />
                    </ActionForm>
                  ) : (
                    <ActionForm action={saveRule} submit="Turn ON" small inline hidden={{ key: s.key, value: 'true' }} confirm={{ title: `Turn ON ${s.key}?`, text: 'This switches it on for everyone right away.', yes: 'Yes, turn on' }}>
                      <input name="reason" required minLength={5} placeholder="Why it is safe again" style={{ width: 200, marginRight: 6 }} />
                    </ActionForm>
                  )
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sec title="Rules" />
      <table className="register">
        <thead><tr><th>Rule</th><th>Value</th>{canAsk ? <th>Change</th> : null}</tr></thead>
        <tbody>
          {rules.map((x) => (
            <tr key={x.key}>
              <td className="mono">{x.key}<span className="sub" style={{ fontFamily: 'var(--sans)' }}>{x.description}</span></td>
              <td className="mono">{JSON.stringify(x.value)}</td>
              {canAsk ? (
                <td>
                  {x.key === 'platform_fee_percent' ? (
                    <span className="faint">fixed in the database</span>
                  ) : (
                    <ActionForm action={saveRule} submit="Save" small hidden={{ key: x.key }} confirm={{ title: `Save ${x.key}?`, text: 'The new value is used for everyone right away.', yes: 'Yes, save' }}>
                      <div className="actions" style={{ flexWrap: 'nowrap' }}>
                        <input name="value" required defaultValue={JSON.stringify(x.value)} className="mono" style={{ width: 110 }} />
                        <input name="reason" required minLength={5} placeholder="Why" style={{ width: 170 }} />
                      </div>
                    </ActionForm>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
