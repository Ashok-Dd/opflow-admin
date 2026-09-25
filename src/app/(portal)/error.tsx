'use client';

/** Any page that fails shows this instead of a blank screen; the menu keeps working. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="slip" style={{ maxWidth: 560 }}>
      <h3>This page could not be shown</h3>
      <p className="muted">Something went wrong while loading it. Please try again. If it keeps happening, send this code to the developer: <span className="mono">{error.digest ?? 'no code'}</span></p>
      <button className="btn" onClick={reset}>Try again</button>
    </div>
  );
}
