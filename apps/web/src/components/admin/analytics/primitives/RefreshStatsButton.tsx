/**
 * Bouton « Rafraîchir les stats » — déclenche un refresh manuel des analytics
 * (vide le snapshot des longues fenêtres + rafraîchit les matviews DB), puis
 * recharge les données. cf. docs/analytics-audit-qa-2026-05-30 (refresh manuel).
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function RefreshStatsButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch('/api/admin/analytics/refresh', { method: 'POST', cache: 'no-store' });
    } catch {
      // best-effort : on recharge quand même (le serveur peut avoir vidé son cache)
    } finally {
      setLoading(false);
      startTransition(() => router.refresh());
    }
  }

  const busy = loading || pending;
  return (
    <button
      type="button"
      data-testid="analytics-refresh"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? 'Actualisation…' : 'Rafraîchir les stats'}
    </button>
  );
}
