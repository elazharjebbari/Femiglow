'use client';

/**
 * Fraîcheur des données du dashboard emailing + bouton « Rafraîchir »
 * (UX-DASH-004).
 *
 * La page `/admin/emails` est `force-dynamic` : les KPI/badge ne se rafraîchissent
 * qu'au reload complet. Sur un écran de monitoring laissé ouvert, l'opérateur ne
 * sait pas si le « 0 échec » date d'il y a 2 secondes ou d'hier. Ce composant
 * client :
 *   - affiche l'heure de génération du rapport (`role="status"`, fr-FR) ;
 *   - expose un bouton « Rafraîchir » qui appelle `router.refresh()` (re-render
 *     RSC du segment, sans reload navigateur) ;
 *   - se désactive pendant le refresh (anti double-clic).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

function formatGeneratedAt(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function DashboardFreshness({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Garde locale anti double-clic : même si la transition se résout vite, on
  // verrouille le bouton jusqu'au prochain rendu serveur.
  const [refreshing, setRefreshing] = useState(false);
  const hhmm = formatGeneratedAt(generatedAt);

  const onRefresh = () => {
    if (refreshing || isPending) return;
    setRefreshing(true);
    startTransition(() => {
      router.refresh();
    });
  };

  const busy = refreshing || isPending;

  return (
    <div className="flex items-center gap-3 text-xs text-stone-500">
      <span role="status" aria-live="polite">
        Données à jour au{' '}
        <time dateTime={generatedAt} className="font-medium text-stone-700">
          {hhmm ?? '—'}
        </time>
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        aria-busy={busy}
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Rafraîchissement…' : '↻ Rafraîchir'}
      </button>
    </div>
  );
}
