/**
 * HistoryTimeline — timeline + diff + restore d'un champ (P11).
 *
 * Reçoit côté serveur la liste des entrées d'historique (déjà décodées).
 * Permet à l'éditeur de :
 *   1. survoler la timeline (verticale, ordre desc),
 *   2. sélectionner deux versions « avant » / « après » pour comparer,
 *   3. cliquer « Restaurer cette version » → POST /restore (crée un draft).
 *
 * On délègue le diff visuel à <FieldDiffView> (text-based ou json-based
 * selon le type).
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ComponentFieldDefinition, FieldHistoryAction } from '@/lib/db/types';
import { FieldDiffView } from './FieldDiffView';

export interface HistoryEntry {
  id: string;
  version: number;
  value: unknown;
  status: string;
  action: FieldHistoryAction;
  actorId: string | null;
  notes: string | null;
  createdAt: string; // ISO
}

interface Props {
  componentKey: string;
  fieldDef: ComponentFieldDefinition;
  entries: HistoryEntry[];
  /** Locale courante. v1 toujours 'fr'. */
  locale?: string;
}

const TZ = 'Europe/Paris';

function formatParis(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

const ACTION_LABEL: Record<FieldHistoryAction, string> = {
  create: 'Création',
  update: 'Modification',
  publish: 'Publication',
  unpublish: 'Dépublication',
  restore: 'Restauration',
  archive: 'Archivage',
  schedule: 'Programmation',
  unschedule: 'Annulation programmation',
};

const ACTION_TONE: Record<FieldHistoryAction, string> = {
  create: 'bg-stone-100 text-stone-700',
  update: 'bg-amber-50 text-amber-800',
  publish: 'bg-emerald-50 text-emerald-800',
  unpublish: 'bg-stone-100 text-stone-700',
  restore: 'bg-blue-50 text-blue-800',
  archive: 'bg-stone-100 text-stone-700',
  schedule: 'bg-purple-50 text-purple-800',
  unschedule: 'bg-stone-100 text-stone-700',
};

export function HistoryTimeline({
  componentKey,
  fieldDef,
  entries,
  locale = 'fr',
}: Props): JSX.Element {
  const router = useRouter();

  // Sélection diff : par défaut, dernière vs avant-dernière (si dispo).
  const initialAfter = entries[0]?.id ?? null;
  const initialBefore = entries[1]?.id ?? entries[0]?.id ?? null;
  const [beforeId, setBeforeId] = useState<string | null>(initialBefore);
  const [afterId, setAfterId] = useState<string | null>(initialAfter);

  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const beforeEntry = useMemo(
    () => entries.find((e) => e.id === beforeId) ?? null,
    [entries, beforeId],
  );
  const afterEntry = useMemo(
    () => entries.find((e) => e.id === afterId) ?? null,
    [entries, afterId],
  );

  async function handleRestore(historyId: string): Promise<void> {
    if (restoring) return;
    setRestoring(historyId);
    setError(null);
    try {
      const url = `/api/admin/components/${encodeURIComponent(
        componentKey,
      )}/fields/${encodeURIComponent(fieldDef.key)}/restore?locale=${encodeURIComponent(locale)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ historyId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Erreur ${res.status}`);
        setRestoring(null);
        return;
      }
      // Succès : revient au panneau d'édition (le draft restauré sera chargé).
      router.push(`/admin/components/${componentKey}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
      setRestoring(null);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
        Aucun historique pour ce champ.
      </p>
    );
  }

  return (
    <section
      className="history-timeline grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]"
      aria-label="Historique des versions"
    >
      <ol className="timeline relative space-y-3" aria-label="Versions">
        {entries.map((e) => {
          const isBefore = e.id === beforeId;
          const isAfter = e.id === afterId;
          return (
            <li
              key={e.id}
              className={`rounded-md border px-3 py-2 text-sm ${
                isAfter
                  ? 'border-emerald-300 bg-emerald-50'
                  : isBefore
                  ? 'border-red-300 bg-red-50'
                  : 'border-stone-200 bg-white'
              }`}
              data-history-id={e.id}
              data-selected={isAfter ? 'after' : isBefore ? 'before' : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${ACTION_TONE[e.action]}`}
                >
                  {ACTION_LABEL[e.action]}
                </span>
                <span className="text-xs tabular-nums text-stone-500">
                  v{e.version}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                <time dateTime={e.createdAt}>{formatParis(e.createdAt)}</time>
                {e.actorId ? <> · {e.actorId}</> : null}
              </p>
              {e.notes ? (
                <p className="mt-1 text-xs italic text-stone-500">{e.notes}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-50"
                  onClick={() => setBeforeId(e.id)}
                  aria-pressed={isBefore}
                >
                  Avant
                </button>
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-50"
                  onClick={() => setAfterId(e.id)}
                  aria-pressed={isAfter}
                >
                  Après
                </button>
                <button
                  type="button"
                  className="ml-auto rounded bg-stone-900 px-2 py-0.5 text-xs text-white disabled:opacity-50"
                  onClick={() => void handleRestore(e.id)}
                  disabled={restoring !== null}
                >
                  {restoring === e.id ? 'Restauration…' : 'Restaurer'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="diff-panel space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-stone-800">
            Comparaison des versions
          </h3>
          <p className="text-xs text-stone-500">
            {beforeEntry && afterEntry ? (
              <>
                v{beforeEntry.version} ({formatParis(beforeEntry.createdAt)}) → v
                {afterEntry.version} ({formatParis(afterEntry.createdAt)})
              </>
            ) : (
              <>Sélectionnez « Avant » et « Après » dans la timeline.</>
            )}
          </p>
        </header>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {beforeEntry && afterEntry ? (
          <FieldDiffView
            fieldType={fieldDef.type}
            before={beforeEntry.value}
            after={afterEntry.value}
            labelBefore={`v${beforeEntry.version}`}
            labelAfter={`v${afterEntry.version}`}
          />
        ) : null}
      </div>
    </section>
  );
}
