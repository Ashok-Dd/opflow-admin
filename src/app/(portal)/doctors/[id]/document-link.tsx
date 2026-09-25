'use client';

import { useState } from 'react';

import { openDocument } from '../../actions';

/** Private documents open through a 5-minute link, made only when clicked (and logged). */
export function DocumentLink({ doctorId, docId }: { doctorId: string; docId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn ghost small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await openDocument(doctorId, docId);
          setBusy(false);
          if ('error' in r) setError(r.error);
          else window.open(r.url, '_blank', 'noopener');
        }}
      >
        {busy ? 'Opening…' : 'Open'}
      </button>
      {error ? <span className="err" style={{ display: 'block' }}>{error}</span> : null}
    </>
  );
}
