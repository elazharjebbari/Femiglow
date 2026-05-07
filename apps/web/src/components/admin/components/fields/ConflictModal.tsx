/**
 * ConflictModal — résolution explicite d'un 409 (F3).
 *
 * Affiche les deux versions (locale vs serveur) et propose deux issues :
 *   - Garder la mienne → `onKeepLocal()` (le hook fera un PATCH sans If-Match).
 *   - Reprendre celle du serveur → `onAcceptRemote()` (le hook fera un GET
 *     + RELOAD).
 *
 * Pas de merge auto : pour un admin solo, le diff visuel suffit.
 *
 * Cf. docs/components-cms/frontend/03-form-engine.md §Conflit
 */
'use client';

import { useEffect, useRef } from 'react';
import type { ConflictModalState } from './reducer';

interface Props {
  conflict: ConflictModalState;
  onKeepLocal: () => void;
  onAcceptRemote: () => void;
  onClose: () => void;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function ConflictModal({ conflict, onKeepLocal, onAcceptRemote, onClose }: Props): JSX.Element {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // Focus sur le dialog au montage (a11y).
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      aria-describedby="conflict-desc"
      tabIndex={-1}
      className="conflict-modal"
    >
      <header>
        <h2 id="conflict-title">Conflit de version</h2>
        <button type="button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </header>
      <p id="conflict-desc">
        Une autre modification a été enregistrée le{' '}
        <time dateTime={conflict.remoteUpdatedAt}>{conflict.remoteUpdatedAt}</time>
        {conflict.remoteAuthorId ? ` par ${conflict.remoteAuthorId}` : null}.
      </p>
      <div className="conflict-versions">
        <section aria-labelledby="conflict-local-title">
          <h3 id="conflict-local-title">Votre version</h3>
          <pre>{formatValue(conflict.localValue)}</pre>
        </section>
        <section aria-labelledby="conflict-remote-title">
          <h3 id="conflict-remote-title">Version sur le serveur</h3>
          <pre>{formatValue(conflict.remoteValue)}</pre>
        </section>
      </div>
      <footer className="conflict-actions">
        <button type="button" onClick={onKeepLocal}>
          Garder la mienne
        </button>
        <button type="button" onClick={onAcceptRemote}>
          Reprendre celle du serveur
        </button>
      </footer>
    </div>
  );
}
