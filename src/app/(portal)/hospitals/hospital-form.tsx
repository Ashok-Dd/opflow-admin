import { ActionForm, Field } from '@/components/action-form';
import type { ActionResult } from '@/lib/actions';

export interface HospitalValues {
  id?: string;
  name?: string;
  address?: string;
  area?: string;
  city?: string;
  pin?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  opdTimingsText?: string | null;
  hasEmergency?: boolean;
  departments?: string[];
  status?: string;
}

/** Add / edit a hospital. Departments decide which "types of doctor" patients find there. */
export function HospitalForm({
  action,
  types,
  v = {},
  submit,
}: {
  action: (prev: ActionResult, f: FormData) => Promise<ActionResult>;
  types: { id: string; simpleName: string }[];
  v?: HospitalValues;
  submit: string;
}) {
  return (
    <ActionForm action={action} submit={submit} hidden={v.id ? { id: v.id } : undefined}>
      <Field label="Hospital name"><input name="name" required defaultValue={v.name} /></Field>
      <Field label="Address"><input name="address" required defaultValue={v.address} /></Field>
      <div className="grid3">
        <Field label="Area"><input name="area" required defaultValue={v.area} placeholder="Brodipet" /></Field>
        <Field label="City"><input name="city" required defaultValue={v.city ?? 'Guntur'} /></Field>
        <Field label="PIN"><input name="pin" required pattern="[1-9]\d{5}" defaultValue={v.pin} /></Field>
        <Field label="Latitude" hint="from Google Maps: right-click → the numbers"><input name="lat" required inputMode="decimal" defaultValue={v.lat} /></Field>
        <Field label="Longitude"><input name="lng" required inputMode="decimal" defaultValue={v.lng} /></Field>
        <Field label="Phone"><input name="phone" required defaultValue={v.phone} /></Field>
      </div>
      <Field label="OPD timings, as patients read them" hint="optional">
        <input name="opdTimingsText" defaultValue={v.opdTimingsText ?? ''} placeholder="Mon–Sat · 9 AM – 1 PM, 5 PM – 8 PM" />
      </Field>
      <label className="actions" style={{ marginBottom: 12 }}>
        <input type="checkbox" name="hasEmergency" defaultChecked={v.hasEmergency} /> 24-hour emergency
      </label>
      {v.id ? (
        <Field label="Shown to patients">
          <select name="status" defaultValue={v.status ?? 'active'}>
            <option value="active">Yes</option>
            <option value="hidden">No (hidden)</option>
          </select>
        </Field>
      ) : null}
      <fieldset style={{ border: '1px solid var(--rule)', padding: '8px 12px 4px', marginBottom: 12 }}>
        <legend className="muted" style={{ fontSize: 12 }}>Departments</legend>
        <div className="grid3">
          {types.map((t) => (
            <label key={t.id} className="actions" style={{ marginBottom: 6 }}>
              <input type="checkbox" name="departments" value={t.id} defaultChecked={v.departments?.includes(t.id)} /> {t.simpleName}
            </label>
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
