'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => undefined;
/** True in the browser (after hydration), false on the server. */
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

/**
 * The OPflow loader, the same as the app's (op_loader.dart): a one-second loop — the O ring draws, the P follows,
 * the heartbeat runs across the O, then it fades and starts again. Still mark with "reduce motion".
 * The same loader as the app and the doctor website.
 */
export function OpLoader({ size = 56, color = 'var(--forest)', beat = 'var(--fern)', label = 'Loading' }: { size?: number; color?: string; beat?: string; label?: string }) {
  return (
    <svg className="op-loader" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
      <g className="op-fade">
        {/* O ring, drawn from the top, clockwise */}
        <path className="op-ring" pathLength={1} d="M30 28.5a21.5 21.5 0 1 1 0 43a21.5 21.5 0 1 1 0 -43" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />
        <path className="op-stem" pathLength={1} d="M64 28.5V80" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />
        <path className="op-bowl" pathLength={1} d="M64 28.5h10a13.5 13.5 0 0 1 0 27H64" fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <path className="op-beat" pathLength={1} d="M14.95 50h8.6l2.8 4.73 3.44-15.48 3.65 20.21 3.01-9.46h8.6" fill="none" stroke={beat} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** The loader with a short line under it, for a part of a page that is loading. */
export function OpLoadingPanel({ text, height = 260 }: { text: string; height?: number }) {
  return (
    <div className="op-panel" style={{ minHeight: height }} role="status" aria-live="polite">
      <OpLoader size={58} />
      <span>{text}</span>
    </div>
  );
}

/**
 * Full-screen layer while something important happens ("Starting OPD…"), like the app's runWithLoader.
 * A modal <dialog>, so it sits above open sheets too and keeps clicks and Esc away until the work is done.
 */
export function OpLoadingScreen({ message, detail }: { message: string; detail?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inBrowser = useInBrowser();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, [inBrowser]);
  if (!inBrowser) return null;
  // Drawn into <body>: nothing around it can change its look.
  return createPortal(
    <dialog ref={ref} className="op-screen" aria-busy="true" aria-label={message} onCancel={(e) => e.preventDefault()}>
      <div className="op-screen-card" role="status" aria-live="polite">
        <OpLoader size={72} />
        <b>{message}</b>
        {detail ? <span>{detail}</span> : null}
      </div>
    </dialog>,
    document.body,
  );
}
