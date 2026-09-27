'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/** What to ask before an action: a title, what will happen, and the words on the "yes" button. */
export type Ask = { title: string; text?: string; yes?: string; danger?: boolean };

const noSubscribe = () => () => undefined;
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

/**
 * "Are you sure?" in the OPflow look (the same box as the doctor website), instead of the browser's grey popup.
 * `confirm(ask)` resolves true when the admin presses the yes button. The box is drawn straight into <body>,
 * so styles around it (the sidebar, tables) never change how it looks.
 */
export function useConfirm() {
  const [ask, setAsk] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const inBrowser = useInBrowser();
  const confirm = useCallback((a: Ask) => new Promise<boolean>((resolve) => setAsk({ ...a, resolve })), []);
  const close = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) d.showModal();
    if (!ask && d.open) d.close();
  }, [ask, inBrowser]);

  const dialog = inBrowser
    ? createPortal(
        <dialog
          ref={ref}
          className="ask-dlg"
          aria-label={ask?.title ?? ''}
          onCancel={(e) => {
            e.preventDefault();
            close(false);
          }}
          onClick={(e) => {
            if (e.target === ref.current) close(false); // a click on the dimmed background
          }}
        >
          {ask ? (
            <div className="in">
              <h3>{ask.title}</h3>
              {ask.text ? <p className="lead">{ask.text}</p> : null}
              <div className="actions" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" onClick={() => close(false)}>
                  Not now
                </button>
                <button type="button" className={`btn${ask.danger ? ' danger' : ''}`} onClick={() => close(true)} autoFocus>
                  {ask.yes ?? 'Yes, continue'}
                </button>
              </div>
            </div>
          ) : null}
        </dialog>,
        document.body,
      )
    : null;

  return { confirm, dialog };
}
