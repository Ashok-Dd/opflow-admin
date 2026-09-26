'use client';

import { useState } from 'react';

import { Field } from '@/components/action-form';

import { geocode } from '../actions';

/** "16.30, 80.44", a Google Maps link (…/@16.30,80.44,17z or ?q=16.30,80.44) → the two numbers, if inside India. */
export function parseLocation(text: string): { lat: number; lng: number } | null {
  const t = decodeURIComponent(text.trim());
  const patterns = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/];
  for (const p of patterns) {
    const m = p.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (lat > 6 && lat < 37 && lng > 68 && lng < 98) return { lat, lng };
    }
  }
  return null;
}

/**
 * The hospital's exact spot, for "Directions" and "near you" in the app. Three ways: search from the address,
 * paste from Google Maps, or type the numbers. "Check on Google Maps" confirms the pin is on the building.
 */
export function LocationPicker({ lat: lat0, lng: lng0 }: { lat?: number; lng?: number }) {
  const [lat, setLat] = useState(lat0 !== undefined ? String(lat0) : '');
  const [lng, setLng] = useState(lng0 !== undefined ? String(lng0) : '');
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ address: string; lat: number; lng: number }[]>([]);

  function use(p: { lat: number; lng: number }) {
    setLat(p.lat.toFixed(6));
    setLng(p.lng.toFixed(6));
    setResults([]);
    setNote('Location set. Check it on Google Maps before saving.');
  }

  async function search() {
    const form = document.querySelector<HTMLFormElement>('form:has(input[name=address])');
    const val = (n: string) => (form?.querySelector<HTMLInputElement>(`input[name=${n}]`)?.value ?? '').trim();
    const q = [val('name'), val('address'), val('area'), val('city'), val('pin'), 'Andhra Pradesh'].filter(Boolean).join(', ');
    if (q.length < 8) return setNote('Type the address, area and city first.');
    setBusy(true);
    setNote(null);
    // The full line first; if nothing, without the hospital name (maps often do not know it).
    let r = await geocode(q);
    if (!('error' in r) && r.length === 0) r = await geocode([val('address'), val('area'), val('city'), val('pin')].filter(Boolean).join(', '));
    setBusy(false);
    if ('error' in r) return setNote(r.error);
    if (r.length === 0) return setNote('Not found. Paste the location from Google Maps instead.');
    setResults(r);
  }

  const ok = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== '' && lng !== '';

  return (
    <div className="slip" style={{ margin: '4px 0 14px', padding: 16 }}>
      <h3 style={{ marginBottom: 6 }}>Location on the map</h3>
      <p className="muted" style={{ margin: '0 0 12px' }}>Patients get directions to this spot, and &quot;near you&quot; is counted from it.</p>
      <div className="actions" style={{ marginBottom: 10 }}>
        <button type="button" className="btn ghost small" onClick={search} disabled={busy}>{busy ? 'Searching…' : 'Find from the address'}</button>
        {ok ? (
          <a className="btn ghost small" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">Check on Google Maps ↗</a>
        ) : null}
      </div>
      {results.length ? (
        <ul className="checklist" style={{ marginBottom: 10 }}>
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`} style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{r.address}</span>
              <button type="button" className="btn small" onClick={() => use(r)}>Use this</button>
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Or paste from Google Maps" hint="the link of the hospital, or the two numbers (right-click the spot → copy)">
        <input
          value={paste}
          placeholder="https://maps.google.com/…  or  16.3067, 80.4365"
          onChange={(e) => {
            setPaste(e.target.value);
            const p = parseLocation(e.target.value);
            if (p) use(p);
            else if (e.target.value.trim()) setNote('Could not read a place in India from this. Try the two numbers.');
          }}
        />
      </Field>
      <div className="grid2">
        <Field label="Latitude"><input name="lat" required inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="16.3067" /></Field>
        <Field label="Longitude"><input name="lng" required inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="80.4365" /></Field>
      </div>
      {note ? <div className="result">{note}</div> : null}
    </div>
  );
}
