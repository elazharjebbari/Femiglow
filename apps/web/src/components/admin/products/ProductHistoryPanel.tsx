'use client';

/**
 * <ProductHistoryPanel> — historique des snapshots pour un produit.
 * Restaure un snapshot dans le draft (sans publier automatiquement).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Snapshot {
  id: string;
  capturedAt: string;
  actorId: string | null;
  note: string | null;
}

interface ProductHistoryPanelProps {
  slug: string;
}

export function ProductHistoryPanel({ slug }: ProductHistoryPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}/snapshots`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur chargement.');
        return;
      }
      const data = (await res.json()) as { items: Snapshot[] };
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRestore(snapshotId: string) {
    if (
      !confirm(
        'Restaurer ce snapshot dans le draft ? (pas de publication automatique)',
      )
    )
      return;
    setRestoringId(snapshotId);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur restore.');
        return;
      }
      setInfo('Snapshot restauré dans le draft.');
      router.refresh();
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
        <div
          role="alert"
          className="mb-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800"
        >
          {error}
        </div>
      ) : null}
      {info ? (
        <div
          role="status"
          className="mb-2 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
        >
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
                <span>
                  {new Date(snap.capturedAt).toLocaleString('fr-FR')}
                </span>
                {snap.note ? (
                  <span className="text-stone-500">{snap.note}</span>
                ) : null}
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
