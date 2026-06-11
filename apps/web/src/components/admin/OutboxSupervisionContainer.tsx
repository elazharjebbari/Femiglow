'use client';

/**
 * OWBS F11 — Conteneur de supervision outbox : charge l'état depuis l'API admin,
 * gère le rejeu, et délègue l'affichage au panneau présentationnel.
 */
import { useCallback, useEffect, useState } from 'react';

import { OutboxSupervisionPanel, type OutboxEffectRow } from './OutboxSupervisionPanel';

interface OutboxData {
  counts: Record<string, number>;
  dead: OutboxEffectRow[];
  pending: OutboxEffectRow[];
}

export function OutboxSupervisionContainer(): JSX.Element {
  const [data, setData] = useState<OutboxData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/leads/outbox', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as OutboxData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onReplay = useCallback(
    async (id: string) => {
      setReplayingId(id);
      try {
        await fetch(`/api/admin/leads/outbox/${id}/replay`, { method: 'POST' });
        await load();
      } finally {
        setReplayingId(null);
      }
    },
    [load],
  );

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Erreur de chargement : {error}
      </p>
    );
  }
  if (!data) {
    return (
      <p role="status" className="text-sm text-stone-500">
        Chargement…
      </p>
    );
  }
  return (
    <OutboxSupervisionPanel
      counts={data.counts}
      dead={data.dead}
      onReplay={onReplay}
      replayingId={replayingId}
    />
  );
}
