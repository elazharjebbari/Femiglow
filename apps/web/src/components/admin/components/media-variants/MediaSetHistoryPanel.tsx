/**
 * MediaSetHistoryPanel — historique d'une cellule (plus récent d'abord)
 * et restauration. Restaurer crée un BROUILLON (jamais une publication
 * directe) ; le brouillon courant est remplacé.
 *
 * Libellés d'actions alignés sur `fields/HistoryTimeline`.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MediaSetsApi } from './api';
import { formatParis } from './model';
import type { MediaSetHistoryEntryJson, MediaSetTuple } from './types';
import { Thumb, btn } from './ui';

const ACTION_LABEL: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  publish: 'Publication',
  unpublish: 'Dépublication',
  restore: 'Restauration',
  archive: 'Archivage',
  schedule: 'Programmation',
  unschedule: 'Annulation programmation',
};

const ACTION_TONE: Record<string, string> = {
  create: 'bg-stone-100 text-stone-700',
  update: 'bg-amber-50 text-amber-800',
  publish: 'bg-emerald-50 text-emerald-800',
  unpublish: 'bg-stone-100 text-stone-700',
  restore: 'bg-blue-50 text-blue-800',
  archive: 'bg-stone-100 text-stone-700',
  schedule: 'bg-purple-50 text-purple-800',
  unschedule: 'bg-stone-100 text-stone-700',
};

function noteLabel(notes: string | null): string | null {
  if (!notes) return null;
  if (notes === 'discard_draft') return 'brouillon abandonné';
  if (notes.startsWith('superseded_by_publish')) return 'remplacé par une publication manuelle';
  return notes;
}

interface Props {
  api: MediaSetsApi;
  tuple: MediaSetTuple;
  /** Incrémenté par le parent après chaque mutation (recharge). */
  reloadTick: number;
  busy: boolean;
  onRestore: (entry: MediaSetHistoryEntryJson) => void;
}

export function MediaSetHistoryPanel({ api, tuple, reloadTick, busy, onRestore }: Props): JSX.Element {
  const [entries, setEntries] = useState<MediaSetHistoryEntryJson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.history(tuple, 30);
      setEntries(res.entries);
    } catch (e) {
      setError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, tuple.slot, tuple.variantDim, tuple.variantKey, tuple.locale]);

  useEffect(() => {
    void load();
  }, [load, reloadTick]);

  return (
    <section aria-labelledby="hmv-history-title" className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
      <h3 id="hmv-history-title" className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Historique de la cellule
      </h3>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      ) : entries === null ? (
        <p className="mt-2 text-sm text-stone-500" aria-live="polite">
          Chargement de l’historique…
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Aucune version enregistrée pour cette cellule.</p>
      ) : (
        <ol role="list" className="mt-2 flex flex-col gap-2">
          {entries.map((e) => {
            const note = noteLabel(e.notes);
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-md border border-stone-200 bg-white p-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ACTION_TONE[e.action] ?? 'bg-stone-100 text-stone-700'}`}
                >
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="text-xs text-stone-700">
                  v{e.version} · <time dateTime={e.createdAt}>{formatParis(e.createdAt, 'long')}</time>
                </span>
                {note ? <span className="text-[11px] text-stone-500">({note})</span> : null}
                <span className="flex -space-x-2">
                  {e.items.slice(0, 4).map((it) => (
                    <Thumb key={`${e.id}-${it.position}`} src={it.thumbUrl} size="xs" />
                  ))}
                </span>
                <span className="text-[11px] text-stone-500">
                  {e.items.length} image{e.items.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  className={btn('secondary', 'ml-auto px-2 py-1 text-[11px]')}
                  onClick={() => onRestore(e)}
                  disabled={busy || e.items.length === 0}
                  aria-label={`Restaurer la version ${e.version} du ${formatParis(e.createdAt, 'long')} en brouillon`}
                >
                  Restaurer en brouillon
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
