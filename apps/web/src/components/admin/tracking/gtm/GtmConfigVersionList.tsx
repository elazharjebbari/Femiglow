'use client';

import { useState } from 'react';
import { IconAlert, IconCheck } from './GtmIcons';

export interface ConfigVersionSummary {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  createdBy: string;
}

interface Props {
  activeId: string | null;
  versions: ConfigVersionSummary[];
  onActivate: (id: string) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onCompare?: (id: string) => void;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `il y a ${sec} s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `il y a ${hour} h`;
  const day = Math.round(hour / 24);
  return `il y a ${day} j`;
}

export function GtmConfigVersionList({
  activeId,
  versions,
  onActivate,
  onDeactivate,
  onDelete,
  onEdit,
  onCompare,
}: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: 'activate' | 'deactivate' | 'delete', id: string) {
    setError(null);
    setPendingId(id);
    try {
      if (action === 'activate') await onActivate(id);
      if (action === 'deactivate' && onDeactivate) await onDeactivate(id);
      if (action === 'delete') await onDelete(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPendingId(null);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
        Aucune version. Crée la première via le formulaire ci-dessus.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      ) : null}

      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
        {versions.map((v) => {
          const isActive = v.id === activeId;
          const isPending = pendingId === v.id;
          const isConfirmingDelete = confirmDeleteId === v.id;
          return (
            <li key={v.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#A8C4A6]/40 bg-[#A8C4A6]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3F5B41]">
                        <IconCheck className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
                        Archivée
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-stone-900">{v.name}</span>
                  </div>
                  {v.notes ? (
                    <p className="mt-1 truncate text-xs text-stone-600">{v.notes}</p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
                    <span title={new Date(v.createdAt).toLocaleString('fr-FR')}>
                      {formatRelative(v.createdAt)}
                    </span>
                    <span className="font-mono">{v.createdBy.slice(0, 16)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => handle('activate', v.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-900 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    >
                      Activer
                    </button>
                  ) : onDeactivate ? (
                    <button
                      type="button"
                      onClick={() => handle('deactivate', v.id)}
                      disabled={isPending}
                      title="Désactive la version (aucune ne sera active). Pour basculer vers une autre, clique Activer sur celle-ci à la place."
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    >
                      Archiver
                    </button>
                  ) : null}

                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(v.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                      title="Charge cette version dans le formulaire pour créer une nouvelle version basée dessus (l'originale reste intacte — audit trail)."
                    >
                      Modifier
                    </button>
                  ) : null}

                  {onCompare ? (
                    <button
                      type="button"
                      onClick={() => onCompare(v.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1"
                    >
                      Voir
                    </button>
                  ) : null}

                  {!isActive ? (
                    isConfirmingDelete ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handle('delete', v.id)}
                          disabled={isPending}
                          className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                        >
                          {isPending ? '…' : 'Confirmer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(v.id)}
                        className="rounded-md px-2 py-1 text-xs text-stone-500 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-1"
                      >
                        Supprimer
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
