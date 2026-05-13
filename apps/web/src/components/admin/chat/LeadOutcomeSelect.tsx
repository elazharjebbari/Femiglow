'use client';

/**
 * CHAT-066 — Mini sélecteur d'outcome inline pour la table /admin/chat/leads.
 *
 * Pourquoi
 * ────────
 * On évite une page de "détail lead" rien que pour cliquer "rejoint" :
 * un `<select>` minimal qui PATCH `/api/admin/chat/leads/[id]/outcome` et
 * rafraîchit la route. Aucun toast, aucun spinner — UX terre-à-terre,
 * suffisant pour Care.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const OUTCOMES = ['pending', 'reached', 'no-answer', 'converted', 'discarded'] as const;
type Outcome = (typeof OUTCOMES)[number];

interface Props {
  leadId: string;
  initialOutcome: Outcome;
}

export function LeadOutcomeSelect({ leadId, initialOutcome }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function commit(next: Outcome) {
    const previous = outcome;
    setOutcome(next);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/leads/${leadId}/outcome`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setOutcome(previous);
      setError((e as Error).message);
    }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <select
        aria-label={`Outcome lead ${leadId}`}
        className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-700 focus:border-stone-500 focus:outline-none"
        value={outcome}
        disabled={isPending}
        onChange={(e) => void commit(e.target.value as Outcome)}
      >
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[10px] text-rose-700" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}
