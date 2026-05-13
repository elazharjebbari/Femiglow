'use client';

import { useCallback, useEffect, useState } from 'react';
import { SyncStatusView, type SyncStatusPayload } from './SyncStatusView';

type Props = {
  initial: SyncStatusPayload;
};

export function SyncStatusLive({ initial }: Props) {
  const [data, setData] = useState<SyncStatusPayload>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracking/gtm/sync-status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SyncStatusPayload;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span>Mise à jour : {refreshing ? '↻ en cours…' : timeAgoLabel(data.generatedAt)}</span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          data-testid="btn-refresh"
          className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs hover:bg-stone-50 disabled:opacity-50"
        >
          ↻ Rafraîchir
        </button>
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          Erreur : {error}
        </div>
      ) : null}
      <SyncStatusView data={data} />
    </div>
  );
}

function timeAgoLabel(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  return `il y a ${min} min`;
}
