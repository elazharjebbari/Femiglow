'use client';

/**
 * OWBS F11 — Panneau de supervision de l'outbox (présentationnel).
 *
 * Affiche les compteurs par statut, alerte si des effets sont `dead` (webhooks
 * jamais livrés), et liste les `dead` avec une action « Rejouer ». Pur (données
 * + callback injectés) → testable isolément. Le conteneur (fetch + replay) le
 * câble à l'API admin.
 */

export interface OutboxEffectRow {
  id: string;
  type: string;
  leadId: string;
  attempts: number;
  lastError: string | null;
}

const STATUSES = ['pending', 'processing', 'done', 'dead'] as const;

export function OutboxSupervisionPanel({
  counts,
  dead,
  onReplay,
  replayingId,
}: {
  counts: Record<string, number>;
  dead: OutboxEffectRow[];
  onReplay: (id: string) => void;
  replayingId?: string | null;
}): JSX.Element {
  const deadCount = counts.dead ?? 0;
  return (
    <section data-testid="outbox-supervision" aria-label="Supervision de l'outbox">
      <div data-testid="outbox-counts" className="flex flex-wrap gap-3">
        {STATUSES.map((s) => (
          <span
            key={s}
            data-testid={`outbox-count-${s}`}
            className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700"
          >
            {s} : <strong>{counts[s] ?? 0}</strong>
          </span>
        ))}
      </div>

      {deadCount > 0 && (
        <p
          role="alert"
          data-testid="outbox-dead-alert"
          className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {deadCount} effet(s) en échec définitif (dead) — à rejouer.
        </p>
      )}

      {dead.length > 0 ? (
        <ul data-testid="outbox-dead-list" className="mt-3 space-y-2">
          {dead.map((r) => (
            <li
              key={r.id}
              data-testid={`outbox-dead-${r.id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <strong>{r.type}</strong> · {r.leadId} · {r.attempts} tentatives
                {r.lastError ? <span className="text-stone-500"> — {r.lastError}</span> : null}
              </span>
              <button
                type="button"
                data-testid={`outbox-replay-${r.id}`}
                onClick={() => onReplay(r.id)}
                disabled={replayingId === r.id}
                className="shrink-0 rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
              >
                {replayingId === r.id ? '…' : 'Rejouer'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="outbox-empty" className="mt-3 text-sm text-stone-500">
          Aucun effet en échec. Tout est sain.
        </p>
      )}
    </section>
  );
}
