'use client';

/**
 * <SeoHistoryPanel> — historique des snapshots audit pour un override.
 * Permet de restaurer un snapshot dans le draft.
 */
import { useEffect, useState } from 'react';

interface Snapshot {
  id: string;
  capturedAt: string;
  actorId: string | null;
}

interface SeoHistoryPanelProps {
  overrideId: string;
  onRestored?: () => void;
}

export function SeoHistoryPanel({ overrideId, onRestored }: SeoHistoryPanelProps) {
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seo/${overrideId}/snapshots`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur chargement.');
        return;
      }
      const data = await res.json();
      setItems(data.items as Snapshot[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideId]);

  async function handleRestore(snapshotId: string) {
    if (!confirm('Restaurer ce snapshot dans le draft ? (pas de publication automatique)')) {
      return;
    }
    setRestoringId(snapshotId);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/seo/${overrideId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur restore.');
        return;
      }
      setInfo('Snapshot restauré dans le draft.');
      onRestored?.();
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <section className="rounded-md border border-stone-200 bg-white p-3">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Historique
        </h2>
        <span className="text-[11px] text-stone-400">
          {loading ? '…' : `${items.length}`}
        </span>
      </header>
      {error ? (
        <div role="alert" className="mb-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">
          {error}
        </div>
      ) : null}
      {info ? (
        <div role="status" className="mb-2 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          {info}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="text-xs text-stone-500">Aucun snapshot.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((snap) => (
            <li
              key={snap.id}
              className="flex items-center justify-between gap-2 rounded-md border border-stone-100 px-2 py-1.5 text-xs"
            >
              <div className="flex flex-col">
                <span>{new Date(snap.capturedAt).toLocaleString('fr-FR')}</span>
                {snap.actorId ? (
                  <span className="font-mono text-[10px] text-stone-400">
                    {snap.actorId}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleRestore(snap.id)}
                disabled={restoringId === snap.id}
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] hover:bg-stone-50 disabled:opacity-40"
              >
                {restoringId === snap.id ? '…' : 'Restaurer'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
