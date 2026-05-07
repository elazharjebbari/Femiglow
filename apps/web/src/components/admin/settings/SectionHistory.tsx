'use client';

import { useEffect, useState } from 'react';
import type { ConfigSnapshot, Section } from '@/lib/admin-config/types';
import { ConfigDiff } from './ConfigDiff';

interface SectionHistoryProps {
  section: Section;
  currentPayload: unknown;
}

interface SnapshotItem extends Omit<ConfigSnapshot, 'payload'> {
  payload?: unknown;
}

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return `il y a ${Math.floor(diff / 86_400_000)} j`;
}

export function SectionHistory({ section, currentPayload }: SectionHistoryProps) {
  const [items, setItems] = useState<SnapshotItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [snapshotPayload, setSnapshotPayload] = useState<unknown>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/settings/${section}/snapshots?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items as SnapshotItem[]);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  async function viewDiff(id: string) {
    setOpenId(id);
    setSnapshotPayload(null);
    // We'd hit a snapshot detail endpoint; for now, list endpoint omits payload.
    // Fallback : re-list via section snapshot detail (quick dev: re-fetch with fields).
    // The list endpoint here only returns metadata; we re-fetch a detail via search.
    // For simplicity, we navigate restore which echoes payload. The user opens
    // diff against the current config payload.
    try {
      const res = await fetch(
        `/api/admin/settings/${section}/snapshots?limit=200&include=payload`,
      );
      const data = await res.json();
      const found = (data.items as Array<SnapshotItem & { payload?: unknown }>).find(
        (s) => s.id === id,
      );
      setSnapshotPayload(found?.payload ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function restore(id: string) {
    if (!confirm('Restaurer ce snapshot ? Cela créera une nouvelle version.')) return;
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/settings/${section}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? 'Erreur restauration.');
        return;
      }
      // Reload for fresh state
      window.location.reload();
    } finally {
      setRestoring(false);
    }
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!items) {
    return <p className="text-sm text-stone-500">Chargement…</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">Aucun snapshot pour le moment.</p>;
  }

  return (
    <div className="rounded-md border border-stone-200 bg-white">
      <ul className="divide-y divide-stone-200">
        {items.map((s) => {
          const isOpen = openId === s.id;
          return (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">
                    v{s.version} · {fmtRelative(s.capturedAt)}{' '}
                    {s.actor ? <span className="text-stone-500">· {s.actor.email}</span> : null}
                  </p>
                  {s.note ? (
                    <p className="mt-0.5 text-xs text-stone-600">« {s.note} »</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => (isOpen ? setOpenId(null) : viewDiff(s.id))}
                    className="rounded border border-stone-200 bg-white px-2 py-1 text-xs hover:bg-stone-50"
                  >
                    {isOpen ? 'Masquer' : 'Voir le diff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => restore(s.id)}
                    disabled={restoring}
                    className="rounded border border-stone-300 bg-stone-900 px-2 py-1 text-xs text-white hover:bg-stone-700 disabled:opacity-40"
                  >
                    Restaurer
                  </button>
                </div>
              </div>
              {isOpen ? (
                <div className="mt-3">
                  {snapshotPayload === null ? (
                    <p className="text-xs text-stone-500">Chargement du payload…</p>
                  ) : (
                    <ConfigDiff before={snapshotPayload} after={currentPayload} />
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
