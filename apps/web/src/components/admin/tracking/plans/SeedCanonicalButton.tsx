'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, trackingPlanApi } from '@/lib/tracking/plan/client';

export function SeedCanonicalButton(): JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importCanonical() {
    if (
      !confirm(
        'Importer le plan canonique FemiGlow ? Cela crée un nouveau brouillon avec tous les événements du catalogue applicatif.',
      )
    )
      return;
    setError(null);
    setBusy(true);
    try {
      const plan = await trackingPlanApi.seedDefault();
      router.push(`/admin/tracking/plans/${plan.id}`);
    } catch (e) {
      if (e instanceof ApiError) setError(`${e.code} — ${e.message}`);
      else setError('Erreur inattendue.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={importCanonical}
        disabled={busy}
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Import…' : 'Importer plan canonique'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
