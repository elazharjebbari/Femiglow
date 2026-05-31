'use client';

/**
 * Bouton « Forcer revalidation » du feed Merchant — admin only.
 *
 * Comportement :
 *  - Clic → POST `/api/admin/products/feed/revalidate`
 *  - Pendant la requête → label « Revalidation… », bouton désactivé
 *  - Succès → toast inline « Feed revalidé » + `router.refresh()` pour
 *    re-fetcher la page admin (l'aperçu XML s'aligne sur le nouveau build)
 *  - Erreur → message d'erreur lisible + le bouton se réarme
 *
 * On suit le même pattern que `ProductPublishButton` (fetch + état
 * local + router.refresh) pour la cohérence UX et pour rester
 * accessible sans dépendance toast tierce.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FeedRevalidateButtonProps {
  /**
   * Endpoint de revalidation. Surchargeable pour les tests, par défaut
   * pointe vers la route admin.
   */
  endpoint?: string;
}

export function FeedRevalidateButton({
  endpoint = '/api/admin/products/feed/revalidate',
}: FeedRevalidateButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setError(data?.error?.message ?? 'Erreur lors de la revalidation.');
        return;
      }
      setSuccess('Feed revalidé. Aperçu rafraîchi.');
      router.refresh();
    } catch (e) {
      // Réseau cassé / timeout : message neutre pour l'admin.
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title="Force la régénération du feed (purge des caches `product-feed` + `product:le-kit`, revalidate /feed.xml et /kit)."
        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        data-testid="admin-feed-revalidate"
      >
        {busy ? 'Revalidation…' : 'Forcer la revalidation'}
      </button>
      {error ? (
        <span className="text-xs text-rose-700" role="alert">
          {error}
        </span>
      ) : null}
      {success ? (
        <span className="text-xs text-emerald-700" role="status">
          {success}
        </span>
      ) : null}
    </div>
  );
}
